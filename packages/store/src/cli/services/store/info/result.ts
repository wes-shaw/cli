import type {StoreInfoFieldError, StoreInfoResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import type {AlertCustomSection} from '@shopify/cli-kit/node/ui'

export type StoreInfoOutputFormat = 'text' | 'json'

export function renderStoreInfoResult(result: StoreInfoResult, format: StoreInfoOutputFormat): void {
  if (format === 'json') {
    outputResult(JSON.stringify(result, null, 2))
    return
  }
  renderInfo({
    headline: `Store info: ${result.shop_domain}`,
    customSections: buildTextSections(result),
  })
}

function buildTextSections(result: StoreInfoResult): AlertCustomSection[] {
  const sections: AlertCustomSection[] = []

  sections.push({
    title: 'Identity',
    body: {list: {items: identityItems(result)}},
  })

  const tier2 = tier2Items(result)
  if (tier2.length > 0) {
    sections.push({
      title: 'Plan & lifecycle',
      body: {list: {items: tier2}},
    })
  }

  const tier3 = tier3Items(result)
  if (tier3.length > 0) {
    sections.push({
      title: 'Admin details',
      body: {list: {items: tier3}},
    })
  }

  if (result._field_errors && Object.keys(result._field_errors).length > 0) {
    sections.push({
      title: 'Missing or partial fields',
      body: {list: {items: fieldErrorItems(result._field_errors)}},
    })
  }

  return sections
}

function identityItems(result: StoreInfoResult): string[] {
  const items: string[] = []
  items.push(`shop_domain: ${result.shop_domain}`)
  pushIfPresent(items, 'display_name', result.display_name)
  pushIfPresent(items, 'shop_id', result.shop_id)
  pushIfPresent(items, 'store_type', result.store_type)
  pushIfPresent(items, 'status', result.status)
  pushIfPresent(items, 'primary_url', result.primary_url)
  pushIfPresent(items, 'admin_url', result.admin_url)
  if (result.owning_org) {
    const orgLine = result.owning_org.id
      ? `${result.owning_org.name} (id: ${result.owning_org.id})`
      : result.owning_org.name
    items.push(`owning_org: ${orgLine}`)
  }
  items.push(`auth_status: ${formatAuthStatus(result.auth_status)}`)
  return items
}

function tier2Items(result: StoreInfoResult): string[] {
  const items: string[] = []
  if (result.plan) {
    const planText = [result.plan.name, result.plan.variant].filter(Boolean).join(' / ')
    if (planText) items.push(`plan: ${planText}`)
  }
  pushIfPresent(items, 'shopify_shop_id', result.shopify_shop_id)
  pushIfPresent(items, 'billing_currency', result.billing_currency)
  pushIfPresent(items, 'created_at', result.created_at)
  pushIfPresent(items, 'last_access', result.last_access)
  if (result.is_main_shop != null) items.push(`is_main_shop: ${String(result.is_main_shop)}`)
  return items
}

function tier3Items(result: StoreInfoResult): string[] {
  const items: string[] = []
  if (result.shop_owner?.name) items.push(`shop_owner: ${result.shop_owner.name}`)
  pushIfPresent(items, 'timezone', result.timezone)
  if (result.setup_required != null) items.push(`setup_required: ${String(result.setup_required)}`)
  if (result.features && Object.keys(result.features).length > 0) {
    const featureText = Object.entries(result.features)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(', ')
    items.push(`features: ${featureText}`)
  }
  return items
}

function fieldErrorItems(errors: Record<string, StoreInfoFieldError>): string[] {
  return Object.entries(errors).map(([field, err]) => `${field} [${err.source}]: ${err.reason}`)
}

function pushIfPresent(items: string[], label: string, value: string | undefined): void {
  if (value) items.push(`${label}: ${value}`)
}

function formatAuthStatus(auth: StoreInfoResult['auth_status']): string {
  if (!auth.authed) return 'not authenticated'
  return auth.expires_at ? `authenticated (expires ${auth.expires_at})` : 'authenticated'
}
