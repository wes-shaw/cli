import {getStoreInfo} from './index.js'
import {fetchDestinationsContext} from './destinations.js'
import {fetchOrganizationShop} from './organization-shop.js'
import {fetchAdminShop} from './admin-shop.js'
import {readAuthStatus} from './auth-status.js'
import type {DestinationNode} from './types.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('./destinations.js')
vi.mock('./organization-shop.js')
vi.mock('./admin-shop.js')
vi.mock('./auth-status.js')

const SHOP = 'shop.myshopify.com'

function destination(overrides: Partial<DestinationNode> = {}): DestinationNode {
  return {
    id: 'gid-dest',
    publicId: 'pub-1',
    name: 'My Shop',
    handle: 'my-shop',
    shortName: 'my-shop',
    primaryDomain: `https://${SHOP}`,
    webUrl: `https://${SHOP}/admin`,
    status: 'ACTIVE',
    accountStatus: 'ACTIVE',
    isAppDevelopment: false,
    lastAccess: '2026-05-20T00:00:00.000Z',
    ...overrides,
  }
}

function orgShop(overrides: Record<string, unknown> = {}) {
  return {
    name: 'My Shop (Org)',
    primaryDomain: `https://${SHOP}`,
    storeType: 'PRODUCTION',
    status: 'active',
    planName: 'Basic',
    planVariantName: 'monthly',
    billingCurrency: 'USD',
    createdAt: '2025-01-01T00:00:00.000Z',
    shortName: 'my-shop',
    ...overrides,
  }
}

describe('getStoreInfo', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(readAuthStatus).mockReturnValue({authed: false, source: 'store-auth'})
  })

  test('throws AbortError when no store is provided', async () => {
    const err = await getStoreInfo({}).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AbortError)
    expect((err as AbortError).message).toContain('No store')
  })

  test('composes Tier 1 + Tier 2 fields from destinations + org-shop', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValueOnce({
      destination: destination(),
      owningOrg: {name: 'Acme', id: '42'},
    })
    vi.mocked(fetchOrganizationShop).mockResolvedValueOnce(orgShop())

    const result = await getStoreInfo({store: SHOP})

    expect(result.shop_domain).toBe(SHOP)
    expect(result.display_name).toBe('My Shop (Org)')
    expect(result.store_type).toBe('PRODUCTION')
    expect(result.status).toBe('active')
    expect(result.primary_url).toBe(`https://${SHOP}`)
    expect(result.admin_url).toBe('https://admin.shopify.com/store/my-shop')
    expect(result.owning_org).toEqual({name: 'Acme'})
    expect(result.plan).toEqual({name: 'Basic', variant: 'monthly'})
    expect(result.billing_currency).toBe('USD')
    expect(result.last_access).toBe('2026-05-20T00:00:00.000Z')
    expect(result.auth_status).toEqual({authed: false, source: 'store-auth'})
    expect(result._field_errors).toBeUndefined()
    expect(fetchAdminShop).not.toHaveBeenCalled()
  })

  test('records _field_errors for Tier 2 fields when org-shop fails', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValueOnce({
      destination: destination(),
      owningOrg: {name: 'Acme', id: '42'},
    })
    vi.mocked(fetchOrganizationShop).mockRejectedValueOnce(new Error('5xx'))

    const result = await getStoreInfo({store: SHOP})

    expect(result.plan).toBeUndefined()
    expect(result.billing_currency).toBeUndefined()
    expect(result._field_errors?.plan?.source).toBe('bp_organizations')
    expect(result._field_errors?.plan?.reason).toContain('5xx')
    expect(result._field_errors?.billing_currency).toBeDefined()
  })

  test('records _field_errors when owning org id is unknown (skips org-shop)', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValueOnce({
      destination: destination(),
      owningOrgError: {source: 'bp_destinations', reason: 'no match'},
    })

    const result = await getStoreInfo({store: SHOP})

    expect(fetchOrganizationShop).not.toHaveBeenCalled()
    expect(result._field_errors?.owning_org?.reason).toBe('no match')
    expect(result._field_errors?.plan?.reason).toBe('no match')
  })

  test('when not authed, silently omits Admin-sourced fields and does not record field errors', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValueOnce({
      destination: destination(),
      owningOrg: {name: 'Acme', id: '42'},
    })
    vi.mocked(fetchOrganizationShop).mockResolvedValueOnce(orgShop())

    const result = await getStoreInfo({store: SHOP})

    expect(fetchAdminShop).not.toHaveBeenCalled()
    expect(result.shop_owner).toBeUndefined()
    expect(result.timezone).toBeUndefined()
    expect(result.setup_required).toBeUndefined()
    expect(result.plus).toBeUndefined()
    expect(result._field_errors).toBeUndefined()
  })

  test('when authed, includes Admin-sourced fields from the admin response', async () => {
    vi.mocked(readAuthStatus).mockReturnValue({
      authed: true,
      source: 'store-auth',
      expires_at: '2026-12-01T00:00:00.000Z',
    })
    vi.mocked(fetchDestinationsContext).mockResolvedValueOnce({
      destination: destination(),
      owningOrg: {name: 'Acme', id: '42'},
    })
    vi.mocked(fetchOrganizationShop).mockResolvedValueOnce(orgShop())
    vi.mocked(fetchAdminShop).mockResolvedValueOnce({
      skipped: false,
      shop: {
        shopOwnerName: 'Alice',
        ianaTimezone: 'America/New_York',
        setupRequired: false,
        shopifyPlus: true,
      },
    })

    const result = await getStoreInfo({store: SHOP})

    expect(result.shop_owner).toEqual({name: 'Alice'})
    expect(result.timezone).toBe('America/New_York')
    expect(result.setup_required).toBe(false)
    expect(result.plus).toBe(true)
    expect(result._field_errors).toBeUndefined()
  })

  test('when authed and admin skipped, records admin-source field errors', async () => {
    vi.mocked(readAuthStatus).mockReturnValue({authed: true, source: 'store-auth'})
    vi.mocked(fetchDestinationsContext).mockResolvedValueOnce({
      destination: destination(),
      owningOrg: {name: 'Acme', id: '42'},
    })
    vi.mocked(fetchOrganizationShop).mockResolvedValueOnce(orgShop())
    vi.mocked(fetchAdminShop).mockResolvedValueOnce({skipped: true, reason: 'Admin 5xx'})

    const result = await getStoreInfo({store: SHOP})

    expect(result._field_errors?.shop_owner?.source).toBe('admin')
    expect(result._field_errors?.shop_owner?.reason).toBe('Admin 5xx')
    expect(result._field_errors?.timezone?.reason).toBe('Admin 5xx')
  })

  test('falls back to destination fields when org-shop is unavailable', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValueOnce({
      destination: destination({isAppDevelopment: true}),
      owningOrgError: {source: 'bp_destinations', reason: 'no match'},
    })

    const result = await getStoreInfo({store: SHOP})

    expect(result.display_name).toBe('My Shop')
    expect(result.store_type).toBe('DEVELOPMENT')
    expect(result.status).toBe('ACTIVE')
    expect(result.primary_url).toBe(`https://${SHOP}`)
  })

  test('builds admin_url from shortName when handle is missing', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValueOnce({
      destination: destination({handle: null, shortName: 'fallback-handle'}),
      owningOrg: {name: 'Acme', id: '42'},
    })
    vi.mocked(fetchOrganizationShop).mockResolvedValueOnce(orgShop())

    const result = await getStoreInfo({store: SHOP})

    expect(result.admin_url).toBe('https://admin.shopify.com/store/fallback-handle')
  })
})
