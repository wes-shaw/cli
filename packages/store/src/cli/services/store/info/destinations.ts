import {AbortError} from '@shopify/cli-kit/node/error'
import {businessPlatformRequest} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import type {DestinationNode, DestinationsContext, StoreInfoFieldError, StoreInfoOwningOrg} from './types.js'

const DESTINATIONS_QUERY = `
  query StoreInfoDestinations($search: String!) {
    currentUserAccount {
      destinations(search: $search, shopsOnly: true, first: 25) {
        nodes {
          id
          publicId
          name
          handle
          shortName
          primaryDomain
          webUrl
          status
          accountStatus
          isAppDevelopment
          lastAccess
        }
      }
    }
  }
`

const ORGANIZATION_FOR_DESTINATION_QUERY = `
  query StoreInfoOwningOrg($destinationPublicId: DestinationPublicID!) {
    currentUserAccount {
      organizationForDestination(destinationPublicId: $destinationPublicId) {
        id
        name
      }
    }
  }
`

export interface DestinationsQueryResponse {
  currentUserAccount?: {
    destinations: {
      nodes: DestinationNode[]
    }
  } | null
}

export interface OrganizationForDestinationResponse {
  currentUserAccount?: {
    organizationForDestination?: {
      id: string
      name: string
    } | null
  } | null
}

export interface FetchDestinationsContextOptions {
  store: string
  token?: string
}

export async function fetchDestinationsContext(options: FetchDestinationsContextOptions): Promise<DestinationsContext> {
  const token = options.token ?? (await ensureAuthenticatedBusinessPlatform())

  const response = await businessPlatformRequest<DestinationsQueryResponse>(DESTINATIONS_QUERY, token, {
    search: options.store,
  })

  const nodes = response.currentUserAccount?.destinations.nodes ?? []
  const matched = nodes.find((node) => node.primaryDomain?.toLowerCase() === options.store.toLowerCase())

  if (!matched) {
    throw new AbortError(
      `Couldn't find a store with domain ${options.store} for the current account.`,
      'Verify the domain (must be the canonical `myshopify.com` FQDN) and that your business-platform session has access to it. Inactive shops are not searchable in v1 of this command.',
    )
  }

  let owningOrg: StoreInfoOwningOrg | undefined
  let owningOrgError: StoreInfoFieldError | undefined

  try {
    const orgResponse = await businessPlatformRequest<OrganizationForDestinationResponse>(
      ORGANIZATION_FOR_DESTINATION_QUERY,
      token,
      {destinationPublicId: matched.publicId},
    )
    const org = orgResponse.currentUserAccount?.organizationForDestination
    if (org) {
      owningOrg = {
        name: org.name,
        ...(org.id ? {id: decodeOrganizationGid(org.id)} : {}),
      }
    } else {
      owningOrgError = {
        source: 'bp_destinations',
        reason: 'organizationForDestination returned no organization for this destination.',
      }
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    owningOrgError = {
      source: 'bp_destinations',
      reason: `Request failed: ${errorMessage(error)}`,
    }
  }

  return {
    destination: matched,
    ...(owningOrg ? {owningOrg} : {}),
    ...(owningOrgError ? {owningOrgError} : {}),
  }
}

function decodeOrganizationGid(gid: string): string | undefined {
  // Org ids come back as base64-encoded GraphQL global ids: "gid://organization/Organization/123".
  // We want the bare numeric id; if the shape doesn't match, fall back to the raw value.
  const decoded = Buffer.from(gid, 'base64').toString('ascii')
  const match = decoded.match(/\/(\d+)$/)
  return match ? match[1] : gid
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
