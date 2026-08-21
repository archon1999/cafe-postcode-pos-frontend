import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  authRepository,
  dispatchPosSessionLocked,
  PosAuthApiError,
  POS_DEVICE_SECURITY_EVENT,
  readStoredDeviceIdentity,
  subscribePosSessionLocked,
  type PosDeviceSecurityCode,
} from 'modules/auth/data-access';
import type {
  PosAuthState,
  PosDevice,
  PosDeviceBinding,
  PosDevicePairing,
  PosSessionContextValue,
  PosSessionPayload,
} from 'modules/auth/domain';
import { derivePosAuthState, transitionPosAuthState } from 'modules/auth/domain';
import { queryClient } from 'shared/api/query-client';

import {
  persistLocale,
  persistSession,
  persistThemeColor,
  persistThemeMode,
  readStoredLocale,
  readStoredSession,
  readStoredThemeColor,
  readStoredThemeMode,
} from '../data-access/storage/session.storage';

const MAX_BROWSER_TIMEOUT_MS = 2_147_000_000;

type InternalContext = PosSessionContextValue & { deviceError: string | null };

const PosSessionContext = createContext<InternalContext | null>(null);

function isDeviceBinding(value: PosDevicePairing | PosDeviceBinding): value is PosDeviceBinding {
  return 'device' in value;
}

export function PosSessionProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<PosAuthState>('UNPAIRED');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [device, setDevice] = useState<PosDevice | null>(null);
  const [pairing, setPairing] = useState<PosDevicePairing | null>(null);
  const [session, updateSession] = useState<PosSessionPayload | null>(() => readStoredSession());
  const [restaurantContext, setRestaurantContext] = useState<PosDeviceBinding['restaurantContext'] | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [themeMode, updateThemeMode] = useState(() => readStoredThemeMode());
  const [themeColor, updateThemeColor] = useState(() => readStoredThemeColor());
  const [locale, updateLocale] = useState(() => readStoredLocale());
  const lockInFlight = useRef(false);
  const pairingStartInFlight = useRef<Promise<void> | null>(null);

  const storeSession = useCallback(
    (nextValue: PosSessionPayload | null) => {
      const normalized = nextValue
        ? {
            ...nextValue,
            ...(restaurantContext ? { restaurantContext } : {}),
          }
        : null;
      updateSession(normalized);
      persistSession(normalized);
      if (device) setAuthState(derivePosAuthState(normalized));
    },
    [device, restaurantContext],
  );

  const applyBinding = useCallback((binding: PosDeviceBinding, candidateSession: PosSessionPayload | null) => {
    const validSession =
      candidateSession?.restaurantContext?.restaurantId &&
      candidateSession.restaurantContext.restaurantId !== binding.restaurantContext.restaurantId
        ? null
        : candidateSession;
    const normalizedSession = validSession ? { ...validSession, restaurantContext: binding.restaurantContext } : null;
    setDevice(binding.device);
    setRestaurantContext(binding.restaurantContext);
    setPairing(null);
    setDeviceError(null);
    updateSession(normalizedSession);
    persistSession(normalizedSession);
    setAuthState(transitionPosAuthState('PAIRING', { type: 'DEVICE_PAIRED', session: normalizedSession }));
  }, []);

  const retryDeviceConnection = useCallback(
    async (silent = false) => {
      setDeviceError(null);
      if (!silent) setIsBootstrapping(true);
      try {
        const binding = await authRepository.restoreDeviceBinding();
        applyBinding(binding, readStoredSession());
      } catch (error) {
        const stored = await readStoredDeviceIdentity().catch(() => null);
        if (stored?.device) setDevice(stored.device);
        if (stored?.restaurantContext) setRestaurantContext(stored.restaurantContext);
        if (error instanceof PosAuthApiError && error.code === 'session_locked' && stored?.device) {
          const lockedSession = readStoredSession();
          if (!stored.restaurantContext && lockedSession?.restaurantContext) {
            setRestaurantContext(lockedSession.restaurantContext);
          }
          updateSession(lockedSession);
          setDeviceError(null);
          setAuthState(derivePosAuthState(lockedSession));
          return;
        }
        const message = error instanceof Error ? error.message : 'Qurilma ulanishini tekshirib bo‘lmadi.';
        setDeviceError(message);
        const securityFailure =
          error instanceof PosAuthApiError &&
          ['device_required', 'device_revoked', 'device_proof_invalid'].includes(error.code || '');
        if (!securityFailure && stored?.device && stored.restaurantContext) {
          // A backend deploy, transient outage, expired rolling lease or an
          // identical transport retry must not turn a permanently paired POS
          // into a revoked/unpaired terminal. Keep the stored non-exportable
          // device key and continue through the already-bound Local Agent.
          applyBinding({ device: stored.device, restaurantContext: stored.restaurantContext }, readStoredSession());
          return;
        }
        if (silent && !securityFailure) return;
        if (error instanceof PosAuthApiError && error.code === 'device_required') {
          setAuthState('UNPAIRED');
        } else {
          setAuthState('REVOKED');
        }
      } finally {
        if (!silent) setIsBootstrapping(false);
      }
    },
    [applyBinding],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const stored = await readStoredDeviceIdentity();
        if (!active) return;

        if (stored?.device) {
          await retryDeviceConnection();
          return;
        }

        if (stored?.pairing && Date.parse(stored.pairing.expiresAt) > Date.now()) {
          setPairing(stored.pairing);
          setAuthState(transitionPosAuthState('UNPAIRED', { type: 'PAIRING_RESTORED', pairing: stored.pairing }));
          return;
        }

        const migrated = await authRepository.tryLegacyDeviceMigration();
        if (!active) return;
        if (migrated) {
          // Silent migration establishes device identity only. An old or
          // expired unbound server session must never be carried across the
          // trust boundary; the cashier performs the normal PIN unlock/login.
          applyBinding(migrated, null);
        } else {
          setAuthState(transitionPosAuthState('UNPAIRED', { type: 'NO_DEVICE' }));
        }
      } catch (error) {
        if (!active) return;
        setDeviceError(error instanceof Error ? error.message : 'Qurilmani ishga tushirib bo‘lmadi.');
        setAuthState('UNPAIRED');
      } finally {
        if (active) setIsBootstrapping(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [applyBinding, retryDeviceConnection]);

  const startPairing = useCallback(async () => {
    if (pairingStartInFlight.current) return pairingStartInFlight.current;
    const operation = (async () => {
      setDeviceError(null);
      setAuthState(transitionPosAuthState('UNPAIRED', { type: 'PAIRING_STARTED' }));
      try {
        const created = await authRepository.createDevicePairing();
        setPairing(created);
      } catch (error) {
        setAuthState('UNPAIRED');
        setDeviceError(error instanceof Error ? error.message : 'QR ulash so‘rovini yaratib bo‘lmadi.');
        throw error;
      }
    })();
    pairingStartInFlight.current = operation;
    try {
      await operation;
    } finally {
      pairingStartInFlight.current = null;
    }
  }, []);

  const refreshPairing = useCallback(async () => {
    const result = await authRepository.readDevicePairingStatus();
    if (isDeviceBinding(result)) {
      queryClient.clear();
      applyBinding(result, null);
      return;
    }
    setPairing(result);
    if (result.status === 'REJECTED' || result.status === 'EXPIRED') setDeviceError('Ulash so‘rovi yakunlanmadi.');
  }, [applyBinding]);

  const cancelPairing = useCallback(async () => {
    await authRepository.clearDeviceIdentity();
    setPairing(null);
    setDevice(null);
    setRestaurantContext(null);
    setDeviceError(null);
    storeSession(null);
    setAuthState(transitionPosAuthState('PAIRING', { type: 'DEVICE_FORGOTTEN' }));
  }, [storeSession]);

  const lockSession = useCallback(
    async (_reason: 'idle' | 'manual' = 'manual') => {
      if (!session?.token || session.lockedAt || lockInFlight.current) return;
      lockInFlight.current = true;
      dispatchPosSessionLocked();
      try {
        await authRepository.lockSession();
      } catch (error) {
        setDeviceError(error instanceof Error ? error.message : 'Serverda sessiyani qulflash tasdiqlanmadi.');
      } finally {
        lockInFlight.current = false;
      }
    },
    [session],
  );

  const unlockSession = useCallback(
    async (pin: string) => {
      // Lock is idempotent. Re-confirm it before every unlock so a POS that
      // went offline while auto-locking cannot become stuck with a locally
      // locked session that the server still considers active.
      await authRepository.lockSession();
      const unlocked = { ...(await authRepository.unlockSession({ pin })), lockedAt: null };
      storeSession(unlocked);
      setAuthState(transitionPosAuthState('LOCKED', { type: 'USER_AUTHENTICATED' }));
      return unlocked;
    },
    [storeSession],
  );

  const changeUser = useCallback(async () => {
    try {
      if (session?.token) await authRepository.logoutSession();
    } catch (error) {
      setDeviceError(error instanceof Error ? error.message : 'Serverda sessiyadan chiqish tasdiqlanmadi.');
    } finally {
      updateSession(null);
      persistSession(null);
      queryClient.clear();
      setAuthState(transitionPosAuthState(authState, { type: 'USER_CHANGED' }));
    }
  }, [authState, session?.token]);

  const forgetRevokedDevice = useCallback(async () => {
    await authRepository.clearDeviceIdentity();
    updateSession(null);
    persistSession(null);
    queryClient.clear();
    setPairing(null);
    setDevice(null);
    setRestaurantContext(null);
    setDeviceError(null);
    setAuthState(transitionPosAuthState('REVOKED', { type: 'DEVICE_FORGOTTEN' }));
  }, []);

  useEffect(() => {
    const applyLockedSession = () => {
      const lockedSession = readStoredSession();
      if (!lockedSession?.token || !lockedSession.lockedAt) return;
      updateSession(lockedSession);
      setAuthState((current) => transitionPosAuthState(current, { type: 'SESSION_LOCKED' }));
      queryClient.clear();
    };
    applyLockedSession();
    return subscribePosSessionLocked(applyLockedSession);
  }, []);

  useEffect(() => {
    const handleSecurityState = (event: Event) => {
      const code = (event as CustomEvent<PosDeviceSecurityCode>).detail;
      if (code === 'device_lease_expired') {
        setDeviceError('Qurilma ruxsati avtomatik yangilanmoqda. Qayta QR ulash talab qilinmaydi.');
        void retryDeviceConnection();
        return;
      }
      updateSession(null);
      persistSession(null);
      queryClient.clear();
      setDeviceError(
        code === 'device_revoked'
          ? 'Bu qurilmaning ruxsati superadmin tomonidan bekor qilingan.'
          : 'Qurilma xavfsizlik tekshiruvidan o‘tmadi. Ulanishni qayta tekshiring.',
      );
      setAuthState(transitionPosAuthState(authState, { type: 'DEVICE_REVOKED' }));
    };
    window.addEventListener(POS_DEVICE_SECURITY_EVENT, handleSecurityState);
    return () => window.removeEventListener(POS_DEVICE_SECURITY_EVENT, handleSecurityState);
  }, [authState, retryDeviceConnection]);

  useEffect(() => {
    if (!device || device.status !== 'ACTIVE' || authState === 'REVOKED') return;
    const renewAt = Date.parse(device.leaseExpiresAt) - 10 * 60_000;
    let timeoutId = 0;
    const scheduleRenewal = () => {
      const remaining = renewAt - Date.now();
      if (remaining > MAX_BROWSER_TIMEOUT_MS) {
        timeoutId = window.setTimeout(scheduleRenewal, MAX_BROWSER_TIMEOUT_MS);
        return;
      }
      timeoutId = window.setTimeout(() => void retryDeviceConnection(true), Math.max(1_000, remaining));
    };
    scheduleRenewal();
    return () => window.clearTimeout(timeoutId);
  }, [authState, device, retryDeviceConnection]);

  const value = useMemo<InternalContext>(
    () => ({
      authState,
      isBootstrapping,
      device,
      pairing,
      deviceError,
      session,
      isAuthenticated: authState === 'AUTHENTICATED',
      restaurantContext,
      setSession: storeSession,
      startPairing,
      refreshPairing,
      cancelPairing,
      lockSession,
      unlockSession,
      changeUser,
      retryDeviceConnection,
      forgetRevokedDevice,
      themeMode,
      setThemeMode: (mode) => {
        updateThemeMode(mode);
        persistThemeMode(mode);
      },
      themeColor,
      setThemeColor: (color) => {
        updateThemeColor(color);
        persistThemeColor(color);
      },
      locale,
      setLocale: (nextLocale) => {
        updateLocale(nextLocale);
        persistLocale(nextLocale);
        void queryClient.invalidateQueries();
      },
    }),
    [
      authState,
      cancelPairing,
      changeUser,
      device,
      deviceError,
      forgetRevokedDevice,
      isBootstrapping,
      locale,
      lockSession,
      pairing,
      refreshPairing,
      restaurantContext,
      retryDeviceConnection,
      session,
      startPairing,
      storeSession,
      themeColor,
      themeMode,
      unlockSession,
    ],
  );

  return <PosSessionContext.Provider value={value}>{children}</PosSessionContext.Provider>;
}

export function usePosSession() {
  const context = useContext(PosSessionContext);
  if (!context) throw new Error('usePosSession must be used inside PosSessionProvider');
  return context;
}
