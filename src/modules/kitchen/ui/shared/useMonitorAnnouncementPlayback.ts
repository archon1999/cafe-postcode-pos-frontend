import { useEffect, useMemo, useRef, useState } from 'react';

import type { KitchenAnnouncement, KitchenMonitorQueue, TvMonitorDiagnosticEvent } from 'modules/kitchen/domain';

export const MONITOR_ANNOUNCEMENT_AUDIO_BASE_PATH = (
  import.meta.env.VITE_MONITOR_ANNOUNCEMENT_BASE_URL || '/monitor-announcements/v1/uz/female'
).replace(/\/+$/, '');
export const MONITOR_AUDIO_UNLOCK_PATH = `${MONITOR_ANNOUNCEMENT_AUDIO_BASE_PATH}/unlock.mp3`;
const FALLBACK_ANIMATION_DURATION_MS = 2200;
const PLAYBACK_WATCHDOG_MS = 15_000;

type PlaybackReporter = (
  event: Extract<TvMonitorDiagnosticEvent, `announcement_${string}`>,
  message: string,
  context: Record<string, unknown>,
) => void;

type QueuedAnnouncement = KitchenAnnouncement & { audioPath: string };

type PlaybackOptions = {
  audioElement?: HTMLAudioElement | null;
  enabled?: boolean;
  onUnavailable?: (message: string) => void;
};

function buildAudioPath(displayName: string) {
  const normalized = displayName.trim();
  const parsedNumber = /^\d+$/.test(normalized) ? Number(normalized) : Number.NaN;
  const fileName =
    Number.isInteger(parsedNumber) && parsedNumber >= 1 && parsedNumber <= 200 ? parsedNumber : 'generic';
  return `${MONITOR_ANNOUNCEMENT_AUDIO_BASE_PATH}/${fileName}.mp3`;
}

function createLegacyAnnouncements(monitorData: KitchenMonitorQueue): KitchenAnnouncement[] {
  return monitorData.recentlyDone.map((ticket) => ({
    id: `ticket:${ticket.id}`,
    orderId: ticket.orderId ?? `ticket:${ticket.id}`,
    orderNumber: ticket.orderNumber,
    displayName: ticket.displayName?.trim() || String(ticket.orderNumber),
    locale: 'uz',
    kind: 'auto',
    createdAt: ticket.completedAt ?? '',
  }));
}

function playFallbackTone() {
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) return;

  try {
    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startAt = context.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(932, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(784, startAt + 0.18);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.08, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.24);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.26);
    window.setTimeout(() => void context.close().catch(() => undefined), 500);
  } catch {
    // The visual fallback still completes when an output device is unavailable.
  }
}

export function useMonitorAnnouncementPlayback(
  monitorData: KitchenMonitorQueue,
  reportPlayback?: PlaybackReporter,
  { audioElement = null, enabled = true, onUnavailable }: PlaybackOptions = {},
) {
  const sourceAnnouncements = useMemo(
    () => (monitorData.announcements?.length ? monitorData.announcements : createLegacyAnnouncements(monitorData)),
    [monitorData],
  );
  const [pendingAnnouncements, setPendingAnnouncements] = useState<QueuedAnnouncement[]>([]);
  const [activeAnnouncement, setActiveAnnouncement] = useState<QueuedAnnouncement | null>(null);
  const seenIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const currentIds = sourceAnnouncements.map((announcement) => announcement.id);
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(currentIds);
      return;
    }

    const unseen = sourceAnnouncements
      .filter((announcement) => !seenIdsRef.current?.has(announcement.id))
      .map((announcement) => ({ ...announcement, audioPath: buildAudioPath(announcement.displayName) }));
    unseen.forEach((announcement) => seenIdsRef.current?.add(announcement.id));
    if (unseen.length) setPendingAnnouncements((current) => [...current, ...unseen]);
  }, [sourceAnnouncements]);

  useEffect(() => {
    if (!enabled || activeAnnouncement || !pendingAnnouncements.length) return;
    setActiveAnnouncement(pendingAnnouncements[0]);
    setPendingAnnouncements((current) => current.slice(1));
  }, [activeAnnouncement, enabled, pendingAnnouncements]);

  useEffect(() => {
    if (!activeAnnouncement || !enabled) return;

    const audio = audioElement ?? new Audio(activeAnnouncement.audioPath);
    if (audioElement) {
      audio.pause();
      audio.src = activeAnnouncement.audioPath;
      audio.currentTime = 0;
      audio.load();
    }
    audio.preload = 'auto';
    let finished = false;
    let fallbackTimer: number | null = null;

    const context = {
      announcementId: activeAnnouncement.id,
      orderId: activeAnnouncement.orderId,
      displayName: activeAnnouncement.displayName,
      kind: activeAnnouncement.kind,
      audioPath: activeAnnouncement.audioPath,
    };
    const finish = (event: 'announcement_play_ended' | 'announcement_play_error', message: string) => {
      if (finished) return;
      finished = true;
      reportPlayback?.(event, message, context);
      setActiveAnnouncement(null);
    };
    const startFallback = (event: 'announcement_play_blocked' | 'announcement_play_error', message: string) => {
      if (finished || fallbackTimer !== null) return;
      reportPlayback?.(event, message, context);
      onUnavailable?.(message);
      playFallbackTone();
      fallbackTimer = window.setTimeout(
        () => finish('announcement_play_error', 'Announcement finished with fallback tone'),
        FALLBACK_ANIMATION_DURATION_MS,
      );
    };
    const handlePlaying = () => reportPlayback?.('announcement_play_started', 'Announcement audio started', context);
    const handleEnded = () => finish('announcement_play_ended', 'Announcement audio ended');
    const handleError = () => startFallback('announcement_play_error', 'Announcement audio failed to load');
    const watchdog = window.setTimeout(
      () => startFallback('announcement_play_error', 'Announcement audio watchdog expired'),
      PLAYBACK_WATCHDOG_MS,
    );

    audio.addEventListener('playing', handlePlaying, { once: true });
    audio.addEventListener('ended', handleEnded, { once: true });
    audio.addEventListener('error', handleError, { once: true });
    try {
      const playResult = audio.play();
      if (playResult && typeof playResult.catch === 'function') {
        void playResult.catch(() => startFallback('announcement_play_blocked', 'Announcement autoplay was blocked'));
      }
    } catch {
      startFallback('announcement_play_blocked', 'Announcement autoplay threw an error');
    }

    return () => {
      finished = true;
      audio.pause();
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      window.clearTimeout(watchdog);
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
    };
  }, [activeAnnouncement, audioElement, enabled, onUnavailable, reportPlayback]);

  const highlightedDoneIds = useMemo(() => {
    if (!activeAnnouncement) return new Set<string>();
    return new Set(
      monitorData.recentlyDone
        .filter(
          (ticket) => ticket.orderId === activeAnnouncement.orderId || activeAnnouncement.id === `ticket:${ticket.id}`,
        )
        .map((ticket) => ticket.id),
    );
  }, [activeAnnouncement, monitorData.recentlyDone]);

  return { activeAnnouncement, highlightedDoneIds };
}
