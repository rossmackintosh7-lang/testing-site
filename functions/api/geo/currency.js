import { json } from '../../_lib/json.js';

const CURRENCY_BY_COUNTRY = {
  GB: { currency: 'GBP', symbol: '£', locale: 'en-GB', region: 'United Kingdom' },
  UK: { currency: 'GBP', symbol: '£', locale: 'en-GB', region: 'United Kingdom' },

  ZA: { currency: 'ZAR', symbol: 'R', locale: 'en-ZA', region: 'South Africa' },
  AU: { currency: 'AUD', symbol: 'A$', locale: 'en-AU', region: 'Australia' },
  NZ: { currency: 'NZD', symbol: 'NZ$', locale: 'en-NZ', region: 'New Zealand' },

  US: { currency: 'USD', symbol: '$', locale: 'en-US', region: 'United States' },
  CA: { currency: 'CAD', symbol: 'C$', locale: 'en-CA', region: 'Canada' },

  IE: { currency: 'EUR', symbol: '€', locale: 'en-IE', region: 'Ireland' },
  FR: { currency: 'EUR', symbol: '€', locale: 'fr-FR', region: 'France' },
  DE: { currency: 'EUR', symbol: '€', locale: 'de-DE', region: 'Germany' },
  ES: { currency: 'EUR', symbol: '€', locale: 'es-ES', region: 'Spain' },
  IT: { currency: 'EUR', symbol: '€', locale: 'it-IT', region: 'Italy' },
  NL: { currency: 'EUR', symbol: '€', locale: 'nl-NL', region: 'Netherlands' },
  BE: { currency: 'EUR', symbol: '€', locale: 'nl-BE', region: 'Belgium' },
  PT: { currency: 'EUR', symbol: '€', locale: 'pt-PT', region: 'Portugal' },
  AT: { currency: 'EUR', symbol: '€', locale: 'de-AT', region: 'Austria' },
  FI: { currency: 'EUR', symbol: '€', locale: 'fi-FI', region: 'Finland' },
  GR: { currency: 'EUR', symbol: '€', locale: 'el-GR', region: 'Greece' },
  LU: { currency: 'EUR', symbol: '€', locale: 'fr-LU', region: 'Luxembourg' },
  MT: { currency: 'EUR', symbol: '€', locale: 'en-MT', region: 'Malta' },
  CY: { currency: 'EUR', symbol: '€', locale: 'en-CY', region: 'Cyprus' },
  EE: { currency: 'EUR', symbol: '€', locale: 'et-EE', region: 'Estonia' },
  LV: { currency: 'EUR', symbol: '€', locale: 'lv-LV', region: 'Latvia' },
  LT: { currency: 'EUR', symbol: '€', locale: 'lt-LT', region: 'Lithuania' },
  SK: { currency: 'EUR', symbol: '€', locale: 'sk-SK', region: 'Slovakia' },
  SI: { currency: 'EUR', symbol: '€', locale: 'sl-SI', region: 'Slovenia' },
  HR: { currency: 'EUR', symbol: '€', locale: 'hr-HR', region: 'Croatia' }
};

function rateFor(currency, env) {
  const fallback = {
    GBP: 1,
    ZAR: 23.5,
    AUD: 1.95,
    NZD: 2.15,
    USD: 1.27,
    CAD: 1.75,
    EUR: 1.17
  };

  const key = `FX_GBP_TO_${currency}`;
  const configured = Number(env[key]);
  return Number.isFinite(configured) && configured > 0 ? configured : fallback[currency] || 1;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const forcedCountry = String(url.searchParams.get('country') || '').trim().toUpperCase();
  const cfCountry = String(request.headers.get('CF-IPCountry') || '').trim().toUpperCase();
  const country = forcedCountry || cfCountry || 'GB';
  const config = CURRENCY_BY_COUNTRY[country] || CURRENCY_BY_COUNTRY.GB;

  return json({
    ok: true,
    country,
    currency: config.currency,
    symbol: config.symbol,
    locale: config.locale,
    region: config.region,
    base_currency: 'GBP',
    rate_from_gbp: rateFor(config.currency, env),
    approximate: config.currency !== 'GBP',
    note: config.currency === 'GBP'
      ? 'Prices are shown in GBP.'
      : 'Converted prices are approximate. Stripe checkout is the final source of truth.'
  });
}
