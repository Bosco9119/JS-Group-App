import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import {
  getPermissionSnapshot,
  requestRequiredPermissions,
  type PermissionSnapshot,
} from '@/lib/permissions';

type PermissionsContextValue = {
  ready: boolean;
  snapshot: PermissionSnapshot;
  refresh: () => Promise<PermissionSnapshot>;
  requestAll: () => Promise<PermissionSnapshot>;
};

const defaultSnapshot: PermissionSnapshot = {
  locationGranted: false,
  notificationGranted: false,
  cameraGranted: false,
  mediaLibraryGranted: false,
  allGranted: false,
};

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState<PermissionSnapshot>(defaultSnapshot);

  const refresh = useCallback(async () => {
    const next = await getPermissionSnapshot();
    setSnapshot(next);
    setReady(true);
    return next;
  }, []);

  const requestAll = useCallback(async () => {
    const next = await requestRequiredPermissions();
    setSnapshot(next);
    setReady(true);
    return next;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  const value = useMemo(
    () => ({
      ready,
      snapshot,
      refresh,
      requestAll,
    }),
    [ready, snapshot, refresh, requestAll],
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionsProvider');
  }
  return context;
}
