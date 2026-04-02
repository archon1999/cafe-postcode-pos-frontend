import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { PosSessionContextValue, PosSessionPayload } from 'modules/auth/domain';
import { queryClient } from 'shared/api/query-client';

import {
  persistLocale,
  persistRestaurantContext,
  persistSession,
  persistThemeMode,
  readStoredLocale,
  readStoredRestaurantContext,
  readStoredSession,
  readStoredThemeMode,
} from '../data-access';

const PosSessionContext = createContext<PosSessionContextValue | null>(null);

export function PosSessionProvider({ children }: { children: ReactNode }) {
  const [session, updateSession] = useState<PosSessionPayload | null>(() => readStoredSession());
  const [restaurantContext, updateRestaurantContext] = useState(() => readStoredRestaurantContext());
  const [themeMode, updateThemeMode] = useState(() => readStoredThemeMode());
  const [locale, updateLocale] = useState(() => readStoredLocale());

  const value = useMemo<PosSessionContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session?.token),
      restaurantContext,
      setRestaurantContext: (nextValue) => {
        updateRestaurantContext(nextValue);
        persistRestaurantContext(nextValue);
      },
      themeMode,
      setThemeMode: (mode) => {
        updateThemeMode(mode);
        persistThemeMode(mode);
      },
      locale,
      setLocale: (nextLocale) => {
        updateLocale(nextLocale);
        persistLocale(nextLocale);
        void queryClient.invalidateQueries();
      },
      setSession: (nextValue) => {
        updateSession(nextValue);
        persistSession(nextValue);
      },
    }),
    [locale, restaurantContext, session, themeMode],
  );

  return <PosSessionContext.Provider value={value}>{children}</PosSessionContext.Provider>;
}

export function usePosSession() {
  const context = useContext(PosSessionContext);

  if (!context) {
    throw new Error('usePosSession must be used inside PosSessionProvider');
  }

  return context;
}
