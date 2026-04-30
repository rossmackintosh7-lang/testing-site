# Turnstile diagnostic patch

This build keeps the same site/theme but improves Turnstile errors.

If login fails again, the red message should now say the real cause, such as:

- TURNSTILE_SECRET_KEY is missing from Cloudflare Pages Variables and Secrets.
- Turnstile secret key is wrong.
- Turnstile token expired or was already used.
- Turnstile browser token was invalid.

Required Cloudflare Pages variable:

TURNSTILE_SECRET_KEY = the Secret Key from the same Cloudflare Turnstile widget as the public sitekey on login/signup.

Also make sure the widget hostnames include:
- purbeckbusinessinnovations.co.uk
- www.purbeckbusinessinnovations.co.uk
- new-upload-3ty.pages.dev

After adding or editing Cloudflare variables, redeploy the Pages project.
