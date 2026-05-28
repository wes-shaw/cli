import {getStoreInfo} from '../../services/store/info/index.js'
import {renderStoreInfoResult} from '../../services/store/info/result.js'
import StoreCommand from '../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {Args} from '@oclif/core'

export default class StoreInfo extends StoreCommand {
  static summary = 'Surface metadata about a Shopify store.'

  static descriptionWithMarkdown = `Reads metadata for a store from the Business Platform Destinations and Organizations APIs.

Tier 1 and Tier 2 fields work without \`store auth\`. Tier 3 fields (shop owner, timezone, features, setup required) require \`store auth\` and are only included when \`--verbose\` is set.

Backend failures degrade gracefully: a single failing call populates \`_field_errors\` rather than aborting the whole command. The command does fail when the destination cannot be resolved.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> shop.myshopify.com',
    '<%= config.bin %> <%= command.id %> shop.myshopify.com --json',
    '<%= config.bin %> <%= command.id %> shop.myshopify.com --verbose',
  ]

  static args = {
    store: Args.string({
      description: 'The myshopify.com domain of the store to inspect.',
      required: true,
      parse: async (input) => normalizeStoreFqdn(input),
    }),
  }

  static flags = {
    ...globalFlags,
    ...jsonFlag,
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(StoreInfo)

    const result = await getStoreInfo({
      store: args.store,
      verbose: Boolean(flags.verbose),
    })

    renderStoreInfoResult(result, flags.json ? 'json' : 'text')
  }
}
