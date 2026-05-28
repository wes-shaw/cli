import {getStoreInfo} from '../../services/store/info/index.js'
import {renderStoreInfoResult} from '../../services/store/info/result.js'
import StoreCommand from '../../utilities/store-command.js'
import {storeFlags} from '../../flags.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class StoreInfo extends StoreCommand {
  static summary = 'Surface metadata about a Shopify store.'

  static descriptionWithMarkdown = `Reads metadata for a store from the Business Platform Destinations and Organizations APIs.

Tier 1 and Tier 2 fields work without \`store auth\`. Tier 3 fields (shop owner, timezone, features, setup required) require \`store auth\` and are only included when \`--verbose\` is set.

Backend failures degrade gracefully: a single failing call populates \`_field_errors\` rather than aborting the whole command. The command does fail when the destination cannot be resolved.`

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
