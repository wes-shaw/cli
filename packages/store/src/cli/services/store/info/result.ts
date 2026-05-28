import type {StoreInfoFieldError, StoreInfoResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {capitalizeWords, formatDate} from '@shopify/cli-kit/common/string'
import type {AlertCustomSection} from '@shopify/cli-kit/node/ui'

export type StoreInfoOutputFormat = 'text' | 'json'

const DATE_FIELDS = new Set(['created_at', 'last_access'])

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

  for (const {title, items} of [
    {title: 'Store', items: storeItems(result)},
    {title: 'Access', items: accessItems(result)},
    {title: 'Plan', items: planItems(result)},
    {title: 'Activity', items: activityItems(result)},
  ]) {
    if (items.length > 0) sections.push({title, body: {list: {items}}})
  }

  if (result._field_errors && Object.keys(result._field_errors).length > 0) {
    sections.push({
      title: 'Missing or partial fields',
      body: {list: {items: fieldErrorItems(result._field_errors)}},
    })
  }

  return sections
}

function storeItems(result: StoreInfoResult): string[] {
  const items: string[] = []
  items.push(line('shop_domain', result.shop_domain))
  pushIfPresent(items, 'display_name', result.display_name)
  pushIfPresent(items, 'store_type', result.store_type)
  pushIfPresent(items, 'status', result.status)
  if (result.setup_required != null) items.push(line('setup_required', formatValue(result.setup_required)))
  if (result.owning_org) items.push(line('owning_org', result.owning_org.name))
  if (result.shop_owner?.name) items.push(line('shop_owner', result.shop_owner.name))
  pushIfPresent(items, 'timezone', result.timezone)
  return items
}

function accessItems(result: StoreInfoResult): string[] {
  const items: string[] = []
  pushIfPresent(items, 'primary_url', result.primary_url)
  pushIfPresent(items, 'admin_url', result.admin_url)
  items.push(line('auth_status', formatAuthStatus(result.auth_status)))
  return items
}

function planItems(result: StoreInfoResult): string[] {
  const items: string[] = []
  if (result.plan) {
    const planText = [result.plan.name, result.plan.variant]
      .filter((value): value is string => Boolean(value))
      .map(capitalizeWords)
      .join(' / ')
    if (planText) items.push(line('plan', planText))
  }
  pushIfPresent(items, 'billing_currency', result.billing_currency)
  if (result.plus != null) items.push(line('plus', formatValue(result.plus)))
  return items
}

function activityItems(result: StoreInfoResult): string[] {
  const items: string[] = []
  pushIfPresent(items, 'created_at', result.created_at)
  pushIfPresent(items, 'last_access', result.last_access)
  return items
}

function fieldErrorItems(errors: Record<string, StoreInfoFieldError>): string[] {
  return Object.entries(errors).map(([field, err]) => `${capitalizeWords(field)} [${err.source}]: ${err.reason}`)
}

function pushIfPresent(items: string[], key: string, value: string | undefined): void {
  if (value) items.push(line(key, formatValue(value, key)))
}

function line(key: string, value: string): string {
  return `${capitalizeWords(key)}: ${value}`
}

function formatValue(value: unknown, key?: string): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string') {
    if (key && DATE_FIELDS.has(key)) return formatUtcDate(value)
    // GraphQL enum values like APP_DEVELOPMENT → "App Development". Skip short all-caps
    // tokens (USD, ID) that are conventionally codes, not enums.
    if (/^[A-Z][A-Z0-9_]*$/.test(value) && (value.includes('_') || value.length > 4)) {
      return capitalizeWords(value)
    }
  }
  return String(value)
}

function formatAuthStatus(auth: StoreInfoResult['auth_status']): string {
  if (!auth.authed) return 'not authenticated'
  return auth.expires_at ? `authenticated (expires ${formatUtcDate(auth.expires_at)})` : 'authenticated'
}

function formatUtcDate(value: string): string {
  return `${formatDate(new Date(value))} UTC`
}
