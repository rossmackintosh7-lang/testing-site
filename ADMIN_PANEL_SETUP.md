# PBI Admin Panel Setup

This build includes a wired admin panel.

## Access URL

```txt
/admin/
```

## Required Cloudflare environment variable

Add this to your Cloudflare Pages project:

```txt
PBI_ADMIN_EMAILS = info@purbeckbusinessinnovations.co.uk,ross@mackintoshprojects.co.uk
```

Use the exact email address you log in with. Separate multiple admin emails with commas.

## How it works

1. Log into PBI normally using an email listed in `PBI_ADMIN_EMAILS`.
2. Open `/admin/`.
3. You can view:
   - Users
   - Customer projects
   - Builder data
   - Published links
   - Billing status
   - Domain choices
   - Custom build enquiries
   - Assisted setup/support requests
4. Use **Open builder** to edit a customer project in admin mode.
5. Use **Publish** to publish a project from the admin panel.

## Important

The admin panel does not cancel Stripe subscriptions. If a customer should stop being billed, cancel their subscription in Stripe as well.


## Expanded admin tools

This version also includes:

- Admin domain checker
- Select/save domain to project
- Custom build project stage tracker
- Missing information checklist
- Email templates
- Simple quote builder
- Domain status and renewal date controls
- Customer email sending
- Internal admin notes
