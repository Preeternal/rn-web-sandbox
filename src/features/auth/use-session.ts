import { useSyncExternalStore } from 'react';

import { getServerSession, getSession, subscribeToSession } from './session';

export function useSession() {
  return useSyncExternalStore(subscribeToSession, getSession, getServerSession);
}
