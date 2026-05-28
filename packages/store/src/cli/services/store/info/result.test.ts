import {renderStoreInfoResult} from './result.js'
import type {StoreInfoResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/ui')

function baseResult(overrides: Partial<StoreInfoResult> = {}): StoreInfoResult {
  return {
    shop_domain: 'shop.myshopify.com',
    display_name: 'My Shop',
    auth_status: {authed: false, source: 'store-auth'},
    ...overrides,
  }
}

describe('renderStoreInfoResult', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('emits JSON via outputResult when format is json', () => {
    renderStoreInfoResult(
      baseResult({
        billing_currency: 'USD',
        _field_errors: {shop_owner: {source: 'cli', reason: 'not authed'}},
      }),
      'json',
    )
    expect(outputResult).toHaveBeenCalledOnce()
    const payload = vi.mocked(outputResult).mock.calls[0]?.[0] as string
    expect(JSON.parse(payload)).toEqual({
      shop_domain: 'shop.myshopify.com',
      display_name: 'My Shop',
      auth_status: {authed: false, source: 'store-auth'},
      billing_currency: 'USD',
      _field_errors: {shop_owner: {source: 'cli', reason: 'not authed'}},
    })
    expect(renderInfo).not.toHaveBeenCalled()
  })

  test('emits complete JSON shape when Tier 3 fields are populated', () => {
    renderStoreInfoResult(
      baseResult({
        store_type: 'PRODUCTION',
        status: 'active',
        primary_url: 'https://shop.myshopify.com',
        admin_url: 'https://admin.shopify.com/store/my-shop',
        owning_org: {name: 'Acme'},
        plan: {name: 'Basic', variant: 'monthly'},
        billing_currency: 'USD',
        created_at: '2025-01-01T00:00:00.000Z',
        last_access: '2026-05-20T00:00:00.000Z',
        shop_owner: {name: 'Alice'},
        timezone: 'America/New_York',
        plus: true,
        setup_required: false,
        auth_status: {authed: true, source: 'store-auth', expires_at: '2026-12-01T00:00:00.000Z'},
      }),
      'json',
    )
    const payload = vi.mocked(outputResult).mock.calls[0]?.[0] as string
    expect(JSON.parse(payload)).toEqual({
      shop_domain: 'shop.myshopify.com',
      display_name: 'My Shop',
      store_type: 'PRODUCTION',
      status: 'active',
      primary_url: 'https://shop.myshopify.com',
      admin_url: 'https://admin.shopify.com/store/my-shop',
      owning_org: {name: 'Acme'},
      auth_status: {authed: true, source: 'store-auth', expires_at: '2026-12-01T00:00:00.000Z'},
      plan: {name: 'Basic', variant: 'monthly'},
      billing_currency: 'USD',
      created_at: '2025-01-01T00:00:00.000Z',
      last_access: '2026-05-20T00:00:00.000Z',
      shop_owner: {name: 'Alice'},
      timezone: 'America/New_York',
      plus: true,
      setup_required: false,
    })
  })

  test('text format includes Store and Access sections by default', () => {
    renderStoreInfoResult(baseResult(), 'text')
    expect(renderInfo).toHaveBeenCalledOnce()
    const opts = vi.mocked(renderInfo).mock.calls[0]?.[0] as {customSections: {title: string}[]}
    const titles = opts.customSections.map((s) => s.title)
    expect(titles).toContain('Store')
    expect(titles).toContain('Access')
  })

  test('text format includes Plan section when plan data is present', () => {
    renderStoreInfoResult(
      baseResult({plan: {name: 'Basic'}, billing_currency: 'USD'}),
      'text',
    )
    const opts = vi.mocked(renderInfo).mock.calls[0]?.[0] as {customSections: {title: string}[]}
    expect(opts.customSections.map((s) => s.title)).toContain('Plan')
  })

  test('text format includes Activity section when activity data is present', () => {
    renderStoreInfoResult(
      baseResult({created_at: '2025-01-01T00:00:00.000Z', last_access: '2026-05-20T00:00:00.000Z'}),
      'text',
    )
    const opts = vi.mocked(renderInfo).mock.calls[0]?.[0] as {customSections: {title: string}[]}
    expect(opts.customSections.map((s) => s.title)).toContain('Activity')
  })

  test('timezone is rendered in the Store section', () => {
    renderStoreInfoResult(baseResult({timezone: 'America/New_York'}), 'text')
    const opts = vi.mocked(renderInfo).mock.calls[0]?.[0] as {
      customSections: {title: string; body: {list: {items: string[]}}}[]
    }
    const store = opts.customSections.find((s) => s.title === 'Store')
    expect(store?.body.list.items.some((item) => item.includes('Timezone: America/New_York'))).toBe(true)
  })

  test('text format adds Missing or partial fields section when _field_errors is non-empty', () => {
    renderStoreInfoResult(
      baseResult({_field_errors: {plan: {source: 'bp_organizations', reason: '5xx'}}}),
      'text',
    )
    const opts = vi.mocked(renderInfo).mock.calls[0]?.[0] as {customSections: {title: string}[]}
    expect(opts.customSections.map((s) => s.title)).toContain('Missing or partial fields')
  })
})
