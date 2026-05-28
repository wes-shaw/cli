import {getCurrentStoredStoreAppSession} from '../auth/session-store.js'
import type {StoreInfoAuthStatus} from './types.js'

export function readAuthStatus(store: string): StoreInfoAuthStatus {
  const session = getCurrentStoredStoreAppSession(store)
  if (!session) {
    return {authed: false, source: 'store-auth'}
  }
  return {
    authed: true,
    source: 'store-auth',
    ...(session.expiresAt ? {expires_at: session.expiresAt} : {}),
  }
}
