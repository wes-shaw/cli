import {prepareAdminStoreGraphQLContext} from '../execute/admin-context.js'
import {adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {AbortError} from '@shopify/cli-kit/node/error'
import {compact} from '@shopify/cli-kit/common/object'
import type {AdminShopFetchOutcome, AdminShopFields} from './types.js'

const ADMIN_SHOP_QUERY = `
  query StoreInfoAdminShop {
    shop {
      shopOwnerName
      ianaTimezone
      setupRequired
      features {
        shopifyPlus
      }
    }
  }
`

interface AdminShopResponse {
  shop: {
    shopOwnerName?: string | null
    ianaTimezone?: string | null
    setupRequired?: boolean | null
    features?: {
      shopifyPlus?: boolean | null
    } | null
  }
}

export async function fetchAdminShop(store: string): Promise<AdminShopFetchOutcome> {
  let context
  try {
    context = await prepareAdminStoreGraphQLContext({store})
  } catch (error) {
    return {
      skipped: true,
      reason: skipReasonForContextError(error, store),
    }
  }

  try {
    const response = await graphqlRequest<AdminShopResponse>({
      query: ADMIN_SHOP_QUERY,
      api: 'Admin',
      url: adminUrl(context.adminSession.storeFqdn, context.version, context.adminSession),
      token: context.adminSession.token,
      responseOptions: {handleErrors: false},
    })

    return {
      skipped: false,
      shop: mapAdminShop(response.shop),
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {
      skipped: true,
      reason: `Admin API request failed: ${errorMessage(error)}`,
    }
  }
}

function mapAdminShop(shop: AdminShopResponse['shop']): AdminShopFields {
  return compact({
    shopOwnerName: shop.shopOwnerName,
    ianaTimezone: shop.ianaTimezone,
    setupRequired: shop.setupRequired,
    shopifyPlus: shop.features?.shopifyPlus,
  }) as AdminShopFields
}

function skipReasonForContextError(error: unknown, store: string): string {
  if (error instanceof AbortError) {
    // Most common: no stored session for this shop. Distinguish from other AbortErrors
    // (e.g. refresh failure) by surfacing the underlying message verbatim, with a hint
    // to run `store auth` when the message indicates a missing/expired session.
    const message = error.message
    if (/store auth|not authenticated|no stored|reauthenticate/i.test(message)) {
      return `No \`store auth\` for ${store} — run \`shopify store auth --store ${store}\` to enable these fields.`
    }
    return message
  }
  return `Could not prepare Admin context for ${store}: ${errorMessage(error)}`
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
