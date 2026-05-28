import {readAuthStatus} from './auth-status.js'
import {fetchDestinationsContext} from './destinations.js'
import {fetchOrganizationShop} from './organization-shop.js'
import {fetchAdminShop} from './admin-shop.js'
import type {
  AdminShopFetchOutcome,
  DestinationsContext,
  OrganizationShopFields,
  StoreInfoAuthStatus,
  StoreInfoFieldError,
  StoreInfoPlan,
  StoreInfoResult,
} from './types.js'
import {AbortError, FatalError} from '@shopify/cli-kit/node/error'
import {compact} from '@shopify/cli-kit/common/object'

export interface GetStoreInfoOptions {
  store?: string
  verbose: boolean
}

const TIER_3_FIELDS = ['shop_owner', 'timezone', 'features', 'setup_required'] as const

export async function getStoreInfo(options: GetStoreInfoOptions): Promise<StoreInfoResult> {
  const store = options.store
  if (!store) {
    throw new AbortError(
      'No store specified.',
      'Pass the `myshopify.com` domain via the `--store` flag, e.g. `shopify store info --store shop.myshopify.com`.',
    )
  }

  const fieldErrors: Record<string, StoreInfoFieldError> = {}

  const destinationsCtx = await fetchDestinationsContext({store})

  const auth = readAuthStatus(store)

  const [orgShopOutcome, adminOutcome] = await Promise.all([
    safeFetchOrganizationShop(destinationsCtx, store, fieldErrors),
    options.verbose && auth.authed ? fetchAdminShop(store) : Promise.resolve<AdminShopFetchOutcome | null>(null),
  ])

  const result = buildResult({
    store,
    destinationsCtx,
    orgShop: orgShopOutcome,
    admin: adminOutcome,
    verbose: options.verbose,
    auth,
    fieldErrors,
  })

  return result
}

async function safeFetchOrganizationShop(
  ctx: DestinationsContext,
  store: string,
  fieldErrors: Record<string, StoreInfoFieldError>,
): Promise<OrganizationShopFields | undefined> {
  if (!ctx.owningOrg?.id) {
    // Without an org id we can't address the BP Organizations API. Surface the reason on
    // every Tier-2 field that depends on it so the caller sees why each is missing.
    const reason = ctx.owningOrgError?.reason ?? 'Owning organization id is unknown.'
    for (const field of TIER_2_ORG_FIELDS) {
      fieldErrors[field] = {source: 'bp_organizations', reason}
    }
    return undefined
  }
  try {
    return await fetchOrganizationShop({store, organizationId: ctx.owningOrg.id})
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    const reason = `Request failed: ${buildErrorReason(error)}`
    for (const field of TIER_2_ORG_FIELDS) {
      fieldErrors[field] = {source: 'bp_organizations', reason}
    }
    return undefined
  }
}

const TIER_2_ORG_FIELDS = ['plan', 'billing_currency', 'created_at'] as const

interface BuildResultArgs {
  store: string
  destinationsCtx: DestinationsContext
  orgShop: OrganizationShopFields | undefined
  admin: AdminShopFetchOutcome | null
  verbose: boolean
  auth: StoreInfoAuthStatus
  fieldErrors: Record<string, StoreInfoFieldError>
}

function buildResult(args: BuildResultArgs): StoreInfoResult {
  const {store, destinationsCtx, orgShop, admin, verbose, auth, fieldErrors} = args
  const destination = destinationsCtx.destination

  if (destinationsCtx.owningOrgError) {
    fieldErrors.owning_org = destinationsCtx.owningOrgError
  }

  const baseFields: Partial<StoreInfoResult> = {
    shop_domain: store,
    display_name: orgShop?.name ?? destination.name,
    store_type: orgShop?.storeType ?? (destination.isAppDevelopment ? 'DEVELOPMENT' : undefined),
    status: orgShop?.status ?? destination.status,
    primary_url: orgShop?.primaryDomain ?? destination.primaryDomain ?? undefined,
    admin_url: buildAdminUrl(destination.handle ?? destination.shortName ?? undefined),
    owning_org: destinationsCtx.owningOrg ? {name: destinationsCtx.owningOrg.name} : undefined,
    plan: orgShop ? buildPlan(orgShop) : undefined,
    billing_currency: orgShop?.billingCurrency,
    created_at: orgShop?.createdAt,
    last_access: destination.lastAccess ?? undefined,
  }

  const result = {...compact(baseFields), auth_status: auth} as StoreInfoResult

  if (verbose) {
    applyVerboseFields(result, admin, auth.authed, store, fieldErrors)
  }

  if (Object.keys(fieldErrors).length > 0) {
    result._field_errors = fieldErrors
  }

  return result
}

function applyVerboseFields(
  result: StoreInfoResult,
  admin: AdminShopFetchOutcome | null,
  authed: boolean,
  store: string,
  fieldErrors: Record<string, StoreInfoFieldError>,
): void {
  if (!authed) {
    const reason = `These fields require \`store auth\`. Run \`shopify store auth --store ${store}\` first.`
    for (const field of TIER_3_FIELDS) {
      fieldErrors[field] = {source: 'cli', reason}
    }
    return
  }

  if (!admin || admin.skipped) {
    const reason = admin?.reason ?? 'Admin API was not queried.'
    for (const field of TIER_3_FIELDS) {
      fieldErrors[field] = {source: 'admin', reason}
    }
    return
  }

  const shop = admin.shop
  Object.assign(
    result,
    compact({
      shop_owner: shop.shopOwnerName ? {name: shop.shopOwnerName} : undefined,
      timezone: shop.ianaTimezone,
      features: shop.features,
      setup_required: shop.setupRequired,
    }),
  )
}

function buildAdminUrl(handle: string | undefined): string | undefined {
  if (!handle) return undefined
  return `https://admin.shopify.com/store/${encodeURIComponent(handle)}`
}

function buildPlan(shop: OrganizationShopFields): StoreInfoPlan | undefined {
  const plan = compact({name: shop.planName, variant: shop.planVariantName}) as StoreInfoPlan
  return Object.keys(plan).length > 0 ? plan : undefined
}

function buildErrorReason(error: unknown): string {
  if (error instanceof FatalError && error.tryMessage) {
    const tryMsg = typeof error.tryMessage === 'string' ? error.tryMessage : String(error.tryMessage)
    return `${error.message} (${tryMsg})`
  }
  if (error instanceof Error) return error.message
  return String(error)
}
