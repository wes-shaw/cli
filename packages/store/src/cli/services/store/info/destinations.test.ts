import {fetchDestinationsContext} from './destinations.js'
import type {DestinationsQueryResponse, OrganizationForDestinationResponse} from './destinations.js'
import {businessPlatformRequest} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/business-platform')
vi.mock('@shopify/cli-kit/node/session')

const SHOP = 'shop.myshopify.com'

function destinationNode(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gid://destination/Destination/1',
    publicId: 'dest-public-1',
    name: 'Shop',
    handle: 'shop',
    shortName: 'shop',
    primaryDomain: `https://${SHOP}`,
    webUrl: `https://${SHOP}/admin`,
    status: 'ACTIVE',
    accountStatus: 'ACTIVE',
    isAppDevelopment: false,
    lastAccess: '2026-05-20T00:00:00.000Z',
    ...overrides,
  }
}

describe('fetchDestinationsContext', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('bp-token')
  })

  test('throws AbortError when no destination matches the domain', async () => {
    vi.mocked(businessPlatformRequest).mockResolvedValueOnce({
      currentUserAccount: {destinations: {nodes: []}},
    } as DestinationsQueryResponse)

    const err = await fetchDestinationsContext({store: SHOP}).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AbortError)
    expect((err as AbortError).message).toContain(SHOP)
  })

  test('throws AbortError when domain match is missing from results', async () => {
    vi.mocked(businessPlatformRequest).mockResolvedValueOnce({
      currentUserAccount: {
        destinations: {
          nodes: [
            destinationNode({
              primaryDomain: 'https://other.myshopify.com',
              webUrl: 'https://other.myshopify.com/admin',
            }),
          ],
        },
      },
    } as DestinationsQueryResponse)

    const err = await fetchDestinationsContext({store: SHOP}).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AbortError)
    expect((err as AbortError).message).toContain(SHOP)
  })

  test('derives canonical myshopify handle from primaryDomain when BP returns handle: null', async () => {
    vi.mocked(businessPlatformRequest)
      .mockResolvedValueOnce({
        currentUserAccount: {
          destinations: {
            nodes: [
              destinationNode({
                handle: null,
                shortName: 'ACT',
                primaryDomain: `https://${SHOP}`,
                webUrl: `https://${SHOP}/admin`,
              }),
            ],
          },
        },
      } as DestinationsQueryResponse)
      .mockResolvedValueOnce({
        currentUserAccount: {organizationForDestination: {id: 'gid', name: 'Org'}},
      } as OrganizationForDestinationResponse)

    const ctx = await fetchDestinationsContext({store: SHOP})

    expect(ctx.destination.handle).toBe('shop')
  })

  test('searches BP with the subdomain rather than the full FQDN', async () => {
    vi.mocked(businessPlatformRequest)
      .mockResolvedValueOnce({
        currentUserAccount: {destinations: {nodes: [destinationNode()]}},
      } as DestinationsQueryResponse)
      .mockResolvedValueOnce({
        currentUserAccount: {organizationForDestination: {id: 'gid', name: 'Org'}},
      } as OrganizationForDestinationResponse)

    await fetchDestinationsContext({store: SHOP})

    expect(vi.mocked(businessPlatformRequest).mock.calls[0]?.[2]).toEqual({search: 'shop'})
  })

  test('returns destination + owning org on success', async () => {
    vi.mocked(businessPlatformRequest)
      .mockResolvedValueOnce({
        currentUserAccount: {destinations: {nodes: [destinationNode()]}},
      } as DestinationsQueryResponse)
      .mockResolvedValueOnce({
        currentUserAccount: {
          organizationForDestination: {
            id: Buffer.from('gid://organization/Organization/123').toString('base64'),
            name: 'Acme Org',
          },
        },
      } as OrganizationForDestinationResponse)

    const ctx = await fetchDestinationsContext({store: SHOP})

    expect(ctx.destination.primaryDomain).toBe(`https://${SHOP}`)
    expect(ctx.owningOrg).toEqual({name: 'Acme Org', id: '123'})
    expect(ctx.owningOrgError).toBeUndefined()
  })

  test('records owning_org field error when the org request throws', async () => {
    vi.mocked(businessPlatformRequest)
      .mockResolvedValueOnce({
        currentUserAccount: {destinations: {nodes: [destinationNode()]}},
      } as DestinationsQueryResponse)
      .mockRejectedValueOnce(new Error('boom'))

    const ctx = await fetchDestinationsContext({store: SHOP})

    expect(ctx.destination.primaryDomain).toBe(`https://${SHOP}`)
    expect(ctx.owningOrg).toBeUndefined()
    expect(ctx.owningOrgError).toEqual({
      source: 'bp_destinations',
      reason: 'Request failed: boom',
    })
  })

  test('records owning_org field error when the org is missing from response', async () => {
    vi.mocked(businessPlatformRequest)
      .mockResolvedValueOnce({
        currentUserAccount: {destinations: {nodes: [destinationNode()]}},
      } as DestinationsQueryResponse)
      .mockResolvedValueOnce({
        currentUserAccount: {organizationForDestination: null},
      } as OrganizationForDestinationResponse)

    const ctx = await fetchDestinationsContext({store: SHOP})

    expect(ctx.owningOrg).toBeUndefined()
    expect(ctx.owningOrgError?.source).toBe('bp_destinations')
  })

  test('uses a provided token without re-authenticating', async () => {
    vi.mocked(businessPlatformRequest).mockResolvedValueOnce({
      currentUserAccount: {destinations: {nodes: [destinationNode()]}},
    } as DestinationsQueryResponse)
    vi.mocked(businessPlatformRequest).mockResolvedValueOnce({
      currentUserAccount: {organizationForDestination: {id: 'gid', name: 'O'}},
    } as OrganizationForDestinationResponse)

    await fetchDestinationsContext({store: SHOP, token: 'preset'})

    expect(ensureAuthenticatedBusinessPlatform).not.toHaveBeenCalled()
    expect(vi.mocked(businessPlatformRequest).mock.calls[0]?.[1]).toBe('preset')
  })
})
