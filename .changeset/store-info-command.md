---
'@shopify/cli': minor
---

Add `shopify store info <store>` command for surfacing shop metadata from the Business Platform Destinations and Organizations APIs. Tier 1 and Tier 2 fields are returned without `store auth`; Tier 3 fields (shop owner, timezone, features, setup required) require `store auth` and are included only with `--verbose`. Individual backend failures degrade gracefully via `_field_errors` rather than aborting the command.
