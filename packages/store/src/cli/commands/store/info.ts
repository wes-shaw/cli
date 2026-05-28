import {getStoreInfo} from '../../services/store/info/index.js'
import {renderStoreInfoResult} from '../../services/store/info/result.js'
import StoreCommand from '../../utilities/store-command.js'
import {storeFlags} from '../../flags.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class StoreInfo extends StoreCommand {
  static summary = 'Surface metadata about a Shopify store.'

  static descriptionWithMarkdown = `Returns metadata about a store you have access to: domain, name, type, status, URLs, plan, billing currency, and more.

Pass \`--verbose\` to include shop owner, timezone, features, and setup status. These extra fields require having run \`store auth\` for the store first.

Use \`--json\` for machine-readable output. When an individual field can't be fetched, the rest of the output is still returned and the missing fields are listed with a reason.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --json',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --verbose',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: storeFlags.store,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreInfo)

    const result = await getStoreInfo({
      store: flags.store,
      verbose: Boolean(flags.verbose),
    })

    renderStoreInfoResult(result, flags.json ? 'json' : 'text')
  }
}
