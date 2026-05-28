type StoreInfoFieldErrorSource = 'bp_destinations' | 'bp_organizations' | 'admin' | 'cli'

export interface StoreInfoFieldError {
  source: StoreInfoFieldErrorSource
  reason: string
}

interface StoreInfoOwningOrg {
  name: string
}

/**
 * Internal-only org reference used to drive the BP Organizations request.
 * We don't surface the organization id in `store info` output.
 */
export interface OwningOrgInternal {
  name: string
  id?: string
}

interface StoreInfoShopOwner {
  name?: string
}

export interface StoreInfoPlan {
  name?: string
  variant?: string
}

export interface StoreInfoAuthStatus {
  authed: boolean
  source: 'store-auth'
  expires_at?: string
}

export interface StoreInfoResult {
  shop_domain: string
  display_name?: string
  store_type?: string
  status?: string
  primary_url?: string
  admin_url?: string
  owning_org?: StoreInfoOwningOrg
  auth_status: StoreInfoAuthStatus

  plan?: StoreInfoPlan
  billing_currency?: string
  created_at?: string
  last_access?: string

  // Sourced from Admin API; only populated when the shop has been authed via `store auth`.
  shop_owner?: StoreInfoShopOwner
  timezone?: string
  setup_required?: boolean
  plus?: boolean

  _field_errors?: Record<string, StoreInfoFieldError>
}

export interface DestinationNode {
  id: string
  publicId: string
  name: string
  handle?: string | null
  shortName?: string | null
  primaryDomain?: string | null
  webUrl: string
  status: 'ACTIVE' | 'INACTIVE'
  accountStatus?: string | null
  isAppDevelopment?: boolean | null
  lastAccess?: string | null
}

export interface DestinationsContext {
  destination: DestinationNode
  owningOrg?: OwningOrgInternal
  owningOrgError?: StoreInfoFieldError
}

export interface OrganizationShopFields {
  name?: string
  primaryDomain?: string
  storeType?: string
  status?: string
  planName?: string
  planVariantName?: string
  billingCurrency?: string
  createdAt?: string
  shortName?: string
}

export type AdminShopFetchOutcome =
  | {skipped: true; reason: string}
  | {skipped: false; shop: AdminShopFields}

export interface AdminShopFields {
  shopOwnerName?: string
  ianaTimezone?: string
  setupRequired?: boolean
  shopifyPlus?: boolean
}
