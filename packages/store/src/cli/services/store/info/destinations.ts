import {extractHost, extractMyshopifyHandle} from './host.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {businessPlatformRequest} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {decodeOrganizationGid} from '@shopify/organizations'
import type {DestinationNode, DestinationsContext, OwningOrgInternal, StoreInfoFieldError} from './types.js'

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

interface FetchDestinationsContextOptions {
  store: string
  token?: string
}

export async function fetchDestinationsContext(options: FetchDestinationsContextOptions): Promise<DestinationsContext> {
  const token = options.token ?? (await ensureAuthenticatedBusinessPlatform())

  // BP's destinations.search matches against handle/name; using the subdomain widens the hit
  // rate vs. passing the full FQDN.
  const lowerStore = options.store.toLowerCase()
  const subdomain = lowerStore.replace(/\.myshopify\.com$/, '')

  const response = await businessPlatformRequest<DestinationsQueryResponse>(DESTINATIONS_QUERY, token, {
    search: subdomain,
  })

  const nodes = response.currentUserAccount?.destinations.nodes ?? []
  const matchedNode = nodes.find((node) => matchesStore(node, lowerStore))

  if (!matchedNode) {
    throw new AbortError(
      `Couldn't find a store with domain ${options.store} for the current account.`,
      'Verify the domain (must be the canonical `myshopify.com` FQDN) and that you are signed in to an account with access to the store. Inactive shops are not searchable.',
    )
  }

  // BP returns `handle: null` and a non-subdomain `shortName` for many shops; derive the
  // canonical myshopify handle from the URL fields so admin_url construction works.
  const canonicalHandle = extractMyshopifyHandle(matchedNode.primaryDomain) ?? extractMyshopifyHandle(matchedNode.webUrl)
  const matched: DestinationNode = {
    ...matchedNode,
    handle: canonicalHandle ?? matchedNode.handle,
  }

  let owningOrg: OwningOrgInternal | undefined
  let owningOrgError: StoreInfoFieldError | undefined

  try {
    const orgResponse = await businessPlatformRequest<OrganizationForDestinationResponse>(
      ORGANIZATION_FOR_DESTINATION_QUERY,
      token,
      {destinationPublicId: matched.publicId},
    )
    const org = orgResponse.currentUserAccount?.organizationForDestination
    if (org) {
      const decodedId = org.id ? decodeOrganizationGid(org.id) : undefined
      owningOrg = {
        name: org.name,
        ...(decodedId ? {id: decodedId} : {}),
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

function matchesStore(node: DestinationNode, lowerStore: string): boolean {
  // BP returns URL strings (sometimes with scheme, sometimes bare) in primaryDomain/webUrl;
  // extract the hostname and compare. handle/shortName are unreliable (often null or an
  // abbreviation rather than the myshopify subdomain).
  return [node.primaryDomain, node.webUrl].some((value) => extractHost(value) === lowerStore)
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
