import {fetchAdminShop} from './admin-shop.js'
import {prepareAdminStoreGraphQLContext} from '../execute/admin-context.js'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('../execute/admin-context.js')
vi.mock('@shopify/cli-kit/node/api/graphql')
vi.mock('@shopify/cli-kit/node/api/admin', () => ({
  adminUrl: (fqdn: string, version: string) => `https://${fqdn}/admin/api/${version}/graphql.json`,
}))

const SHOP = 'shop.myshopify.com'

function adminContext() {
  return {
    adminSession: {storeFqdn: SHOP, token: 'admin-tok'},
    version: '2026-01',
    session: {} as never,
  }
}

describe('fetchAdminShop', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('returns skipped with a hint when no stored auth exists', async () => {
    vi.mocked(prepareAdminStoreGraphQLContext).mockRejectedValueOnce(
      new AbortError('Run `shopify store auth` to authenticate before executing operations against this store.'),
    )

    const result = await fetchAdminShop(SHOP)

    expect(result.skipped).toBe(true)
    if (result.skipped) {
      expect(result.reason).toContain('store auth')
      expect(result.reason).toContain(SHOP)
    }
  })

  test('returns mapped shop fields on success', async () => {
    vi.mocked(prepareAdminStoreGraphQLContext).mockResolvedValueOnce(adminContext() as never)
    vi.mocked(graphqlRequest).mockResolvedValueOnce({
      shop: {
        shopOwnerName: 'Alice',
        ianaTimezone: 'America/New_York',
        setupRequired: false,
        features: {shopifyPlus: true},
      },
    } as never)

    const result = await fetchAdminShop(SHOP)
    expect(result.skipped).toBe(false)
    if (!result.skipped) {
      expect(result.shop).toEqual({
        shopOwnerName: 'Alice',
        ianaTimezone: 'America/New_York',
        setupRequired: false,
        shopifyPlus: true,
      })
    }
  })

  test('omits shopifyPlus when the features object is absent', async () => {
    vi.mocked(prepareAdminStoreGraphQLContext).mockResolvedValueOnce(adminContext() as never)
    vi.mocked(graphqlRequest).mockResolvedValueOnce({
      shop: {
        shopOwnerName: 'Bob',
        ianaTimezone: null,
        setupRequired: null,
        features: null,
      },
    } as never)

    const result = await fetchAdminShop(SHOP)
    expect(result.skipped).toBe(false)
    if (!result.skipped) {
      expect(result.shop).toEqual({shopOwnerName: 'Bob'})
    }
  })

  test('returns skipped with the error message when the Admin request fails', async () => {
    vi.mocked(prepareAdminStoreGraphQLContext).mockResolvedValueOnce(adminContext() as never)
    vi.mocked(graphqlRequest).mockRejectedValueOnce(new Error('network down'))

    const result = await fetchAdminShop(SHOP)
    expect(result.skipped).toBe(true)
    if (result.skipped) {
      expect(result.reason).toContain('network down')
    }
  })
})
