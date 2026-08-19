import type { PosSessionPayload } from 'modules/auth/domain';

import { persistSession, readStoredSession } from './session.storage';

export const POS_SESSION_LOCK_EVENT = 'postcode:session-locked';
export const POS_SESSION_LOCK_CHANNEL = 'postcode-pos-session-lock-v1';
export const POS_SESSION_LOCK_STORAGE_KEY = 'postcode-pos-session-lock-signal-v1';
export const POS_LAST_ACTIVITY_STORAGE_KEY = 'postcode-pos-last-activity-v1';

export type PosSessionLockSignal = {
  type: 'session_locked';
  lockedAt: string;
  eventId: string;
};

function normalizedLockedAt(value: unknown, now = Date.now()) {
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return new Date(Number.isFinite(parsed) ? Math.min(parsed, now) : now).toISOString();
}

function normalizeLockSignal(value: unknown): PosSessionLockSignal | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<PosSessionLockSignal>;
  if (candidate.type !== 'session_locked' || typeof candidate.eventId !== 'string' || !candidate.eventId) return null;
  return {
    type: 'session_locked',
    lockedAt: normalizedLockedAt(candidate.lockedAt),
    eventId: candidate.eventId.slice(0, 128),
  };
}

function newLockEventId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function persistStoredSessionLock(lockedAt: string): PosSessionPayload | null {
  const current = readStoredSession();
  if (!current?.token) return null;
  const next = {
    ...current,
    lockedAt: normalizedLockedAt(current.lockedAt || lockedAt),
  };
  persistSession(next);
  return next;
}

export function dispatchPosSessionLocked(lockedAt = new Date().toISOString()) {
  const signal: PosSessionLockSignal = {
    type: 'session_locked',
    lockedAt: normalizedLockedAt(lockedAt),
    eventId: newLockEventId(),
  };
  persistStoredSessionLock(signal.lockedAt);
  window.dispatchEvent(new CustomEvent<PosSessionLockSignal>(POS_SESSION_LOCK_EVENT, { detail: signal }));

  const serialized = JSON.stringify(signal);
  try {
    localStorage.setItem(POS_SESSION_LOCK_STORAGE_KEY, serialized);
    localStorage.removeItem(POS_SESSION_LOCK_STORAGE_KEY);
  } catch {
    // Same-tab delivery above remains fail-closed when persistent storage is unavailable.
  }
  if (typeof BroadcastChannel === 'function') {
    try {
      const channel = new BroadcastChannel(POS_SESSION_LOCK_CHANNEL);
      channel.postMessage(signal);
      queueMicrotask(() => channel.close());
    } catch {
      // localStorage is the compatibility path for browsers without a usable channel.
    }
  }
  return signal;
}

export function subscribePosSessionLocked(listener: (signal: PosSessionLockSignal) => void) {
  const seen = new Set<string>();
  const deliver = (value: unknown) => {
    const signal = normalizeLockSignal(value);
    if (!signal || seen.has(signal.eventId)) return;
    if (seen.size >= 128) seen.clear();
    seen.add(signal.eventId);
    persistStoredSessionLock(signal.lockedAt);
    listener(signal);
  };
  const handleWindowEvent = (event: Event) => deliver((event as CustomEvent<unknown>).detail);
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== POS_SESSION_LOCK_STORAGE_KEY || !event.newValue) return;
    try {
      deliver(JSON.parse(event.newValue));
    } catch {
      // Ignore malformed cross-tab messages.
    }
  };
  window.addEventListener(POS_SESSION_LOCK_EVENT, handleWindowEvent);
  window.addEventListener('storage', handleStorage);

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel === 'function') {
    try {
      channel = new BroadcastChannel(POS_SESSION_LOCK_CHANNEL);
      channel.addEventListener('message', (event) => deliver(event.data));
    } catch {
      channel = null;
    }
  }
  return () => {
    window.removeEventListener(POS_SESSION_LOCK_EVENT, handleWindowEvent);
    window.removeEventListener('storage', handleStorage);
    channel?.close();
  };
}

function normalizeActivityAt(value: unknown, now = Date.now()) {
  const candidate = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(candidate) || candidate <= 0 || candidate > now) return null;
  return Math.trunc(candidate);
}

export function readPosLastActivityAt(now = Date.now()) {
  try {
    const raw = localStorage.getItem(POS_LAST_ACTIVITY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: unknown; at?: unknown };
    if (parsed.version !== 1) return null;
    return normalizeActivityAt(parsed.at, now);
  } catch {
    try {
      localStorage.removeItem(POS_LAST_ACTIVITY_STORAGE_KEY);
    } catch {
      // A denied storage API must not turn the idle-lock check into an exception.
    }
    return null;
  }
}

export function persistPosLastActivityAt(at = Date.now()) {
  const normalized = normalizeActivityAt(at);
  if (normalized === null) return null;
  try {
    localStorage.setItem(POS_LAST_ACTIVITY_STORAGE_KEY, JSON.stringify({ version: 1, at: normalized }));
  } catch {
    return null;
  }
  return normalized;
}
