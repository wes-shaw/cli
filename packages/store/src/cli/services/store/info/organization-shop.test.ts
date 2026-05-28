import {fetchOrganizationShop} from './organization-shop.js'
import type {OrganizationShopResponse} from './organization-shop.js'
import {businessPlatformOrganizationsRequest} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {BugError} from '@shopify/cli-kit/node/error'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/business-platform')
vi.mock('@shopify/cli-kit/node/session')

const SHOP = 'shop.myshopify.com'
const ORG_ID = '123'

function shopNode(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gid://shop/Shop/1',
    externalId: 'public-1',
    shopifyShopId: '9999',
    name: 'My Shop',
    primaryDomain: `https://${SHOP}`,
    storeType: 'PRODUCTION',
    status: 'active',
    planName: 'Basic',
    planVariantName: 'monthly',
    billingCurrency: 'USD',
    createdAt: '2025-01-01T00:00:00.000Z',
    isMainShop: true,
    shortName: 'my-shop',
    ...overrides,
  }
}

describe('fetchOrganizationShop', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('bp-token')
  })

  test('returns the matched shop node', async () => {
    vi.mocked(businessPlatformOrganizationsRequest).mockResolvedValueOnce({
      organization: {
        id: 'gid',
        name: 'Acme',
        accessibleShops: {edges: [{node: shopNode()}]},
      },
    } as OrganizationShopResponse)

    const shop = await fetchOrganizationShop({store: SHOP, organizationId: ORG_ID})
    expect(shop.shopifyShopId).toBe('9999')
    expect(shop.primaryDomain).toBe(`https://${SHOP}`)
  })

  test('throws BugError when no shop matches the domain', async () => {
    vi.mocked(businessPlatformOrganizationsRequest).mockResolvedValueOnce({
      organization: {
        id: 'gid',
        name: 'Acme',
        accessibleShops: {edges: [{node: shopNode({primaryDomain: 'https://other.myshopify.com'})}]},
      },
    } as OrganizationShopResponse)

    await expect(fetchOrganizationShop({store: SHOP, organizationId: ORG_ID})).rejects.toBeInstanceOf(BugError)
  })

  test('passes organizationId and search variable to the request', async () => {
    vi.mocked(businessPlatformOrganizationsRequest).mockResolvedValueOnce({
      organization: {id: 'gid', name: 'Acme', accessibleShops: {edges: [{node: shopNode()}]}},
    } as OrganizationShopResponse)

    await fetchOrganizationShop({store: SHOP, organizationId: ORG_ID, token: 'preset'})

    const call = vi.mocked(businessPlatformOrganizationsRequest).mock.calls[0]?.[0]
    expect(call?.organizationId).toBe(ORG_ID)
    expect(call?.variables).toEqual({search: SHOP})
    expect(call?.token).toBe('preset')
    expect(ensureAuthenticatedBusinessPlatform).not.toHaveBeenCalled()
  })

  test('throws when organization is missing', async () => {
    vi.mocked(businessPlatformOrganizationsRequest).mockResolvedValueOnce({organization: null} as OrganizationShopResponse)
    await expect(fetchOrganizationShop({store: SHOP, organizationId: ORG_ID})).rejects.toBeInstanceOf(BugError)
  })
})
