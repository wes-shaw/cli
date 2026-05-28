import {readAuthStatus} from './auth-status.js'
import {getCurrentStoredStoreAppSession} from '../auth/session-store.js'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('../auth/session-store.js')

describe('readAuthStatus', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('returns authed=false when no session is stored', () => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(undefined)

    expect(readAuthStatus('shop.myshopify.com')).toEqual({
      authed: false,
      source: 'store-auth',
    })
  })

  test('returns authed=true with expires_at when session has an expiry', () => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({
      store: 'shop.myshopify.com',
      clientId: 'client-id',
      userId: '42',
      accessToken: 'tok',
      scopes: ['read_products'],
      acquiredAt: '2026-05-01T00:00:00.000Z',
      expiresAt: '2026-06-01T00:00:00.000Z',
    })

    expect(readAuthStatus('shop.myshopify.com')).toEqual({
      authed: true,
      source: 'store-auth',
      expires_at: '2026-06-01T00:00:00.000Z',
    })
  })

  test('omits expires_at when the session has no expiry', () => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({
      store: 'shop.myshopify.com',
      clientId: 'client-id',
      userId: '42',
      accessToken: 'tok',
      scopes: ['read_products'],
      acquiredAt: '2026-05-01T00:00:00.000Z',
    })

    expect(readAuthStatus('shop.myshopify.com')).toEqual({
      authed: true,
      source: 'store-auth',
    })
  })
})
