import StoreInfo from './info.js'
import {getStoreInfo} from '../../services/store/info/index.js'
import {renderStoreInfoResult} from '../../services/store/info/result.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../services/store/info/index.js')
vi.mock('../../services/store/info/result.js')
vi.mock('../../services/store/attribution.js')

describe('store info command', () => {
  beforeEach(() => {
    vi.mocked(getStoreInfo).mockResolvedValue({
      shop_domain: 'shop.myshopify.com',
      auth_status: {authed: false, source: 'store-auth'},
    })
  })

  test('passes store and verbose=false through to the service', async () => {
    await StoreInfo.run(['shop.myshopify.com'])

    expect(getStoreInfo).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      verbose: false,
    })
    expect(renderStoreInfoResult).toHaveBeenCalledWith(
      expect.objectContaining({shop_domain: 'shop.myshopify.com'}),
      'text',
    )
  })

  test('passes verbose=true when --verbose flag is set', async () => {
    await StoreInfo.run(['shop.myshopify.com', '--verbose'])

    expect(getStoreInfo).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      verbose: true,
    })
  })

  test('renders json format when --json flag is set', async () => {
    await StoreInfo.run(['shop.myshopify.com', '--json'])

    expect(renderStoreInfoResult).toHaveBeenCalledWith(expect.anything(), 'json')
  })

  test('defines the expected flags and positional arg', () => {
    expect(StoreInfo.args.store).toBeDefined()
    expect(StoreInfo.flags.json).toBeDefined()
    expect(StoreInfo.flags.verbose).toBeDefined()
  })
})
