PBI platform auth starter v2

## Domain checker and paid domain registration

The builder now checks live domain availability through Cloudflare Registrar and returns available suggestions. Customers can select an available domain in the builder, save the project, then choose **Register a new domain** on the payment page. The domain registration fee is added to the first Stripe Checkout payment as a one-time line item.

Required Cloudflare env vars:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` with Registrar permissions

Required/optional domain payment env vars:

- `DOMAIN_REGISTRATION_CURRENCY` defaults to `GBP`
- `DOMAIN_REGISTRATION_DEFAULT_AMOUNT_MINOR` defaults to `2000` (£20.00 base if Cloudflare pricing is not in your checkout currency)
- `DOMAIN_REGISTRATION_ONE_OFF_HANDLING_AMOUNT_MINOR` defaults to `0` and can be used only if you want an extra one-off setup fee on top of the first-year registration cost
- `DOMAIN_AUTO_REGISTER` defaults to off. Set to `true` only after your Cloudflare Registrar account has billing, default registrant contact, and domain registration agreement set up.

Important: when `DOMAIN_AUTO_REGISTER=true`, the Stripe webhook will attempt to register the selected domain after successful payment. Successful registrations are billable and normally non-refundable.


## Domain billing env vars

For new domains, add this Stripe price to Cloudflare Pages so the yearly PBI domain management fee is linked to the customer's subscription:

- `STRIPE_PRICE_DOMAIN_MANAGEMENT_YEARLY` = Stripe recurring yearly price for PBI Domain Management Fee (£10/year)

Optional domain charge settings:

- `DOMAIN_REGISTRATION_DEFAULT_AMOUNT_MINOR` = fallback first-year domain registration amount in pence, default `2000`
- `DOMAIN_REGISTRATION_CURRENCY` = checkout currency, default `GBP`
- `DOMAIN_MANAGEMENT_FEE_AMOUNT_MINOR` = display/tracking amount for annual management fee, default `1000`
- `DOMAIN_REGISTRATION_ONE_OFF_HANDLING_AMOUNT_MINOR` = optional one-off extra setup/handling amount, default `0`

The old `DOMAIN_MARKUP_AMOUNT_MINOR` should no longer be used for the yearly £10 fee, because the yearly fee now belongs in Stripe as `STRIPE_PRICE_DOMAIN_MANAGEMENT_YEARLY`.
