import {extractHost} from './host.js'
import {BugError} from '@shopify/cli-kit/node/error'
import {businessPlatformOrganizationsRequest} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import type {OrganizationShopFields} from './types.js'

const ORGANIZATION_SHOP_QUERY = `
  query StoreInfoShop($search: String) {
    organization {
      id
      name
      accessibleShops(first: 5, search: $search) {
        edges {
          node {
            name
            primaryDomain
            storeType
            status
            planName
            planVariantName
            billingCurrency
            createdAt
            shortName
          }
        }
      }
    }
  }
`

export interface OrganizationShopResponse {
  organization?: {
    id: string
    name: string
    accessibleShops?: {
      edges: {
        node: OrganizationShopFields
      }[]
    }
  } | null
}

interface FetchOrganizationShopOptions {
  store: string
  organizationId: string
  token?: string
}

export async function fetchOrganizationShop(
  options: FetchOrganizationShopOptions,
): Promise<OrganizationShopFields> {
  const token = options.token ?? (await ensureAuthenticatedBusinessPlatform())
  const unauthorizedHandler = {
    type: 'token_refresh' as const,
    handler: async () => {
      const newToken = await ensureAuthenticatedBusinessPlatform()
      return {token: newToken}
    },
  }

  const response = await businessPlatformOrganizationsRequest<OrganizationShopResponse>({
    query: ORGANIZATION_SHOP_QUERY,
    token,
    organizationId: options.organizationId,
    variables: {search: options.store},
    unauthorizedHandler,
  })

  const edges = response.organization?.accessibleShops?.edges ?? []
  const lowerStore = options.store.toLowerCase()
  const matched = edges.map((edge) => edge.node).find((node) => extractHost(node.primaryDomain) === lowerStore)

  if (!matched) {
    throw new BugError(
      `Couldn't find shop ${options.store} inside organization ${options.organizationId}.`,
      'The shop matched a global lookup but is not listed under its parent organization. This usually means the search index is stale; try again in a moment.',
    )
  }

  return matched
}
