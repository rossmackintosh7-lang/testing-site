window.PBICurrency = (() => {
  const FALLBACK_RATES = {
    GBP: 1,
    ZAR: 23.5,
    AUD: 1.95,
    NZD: 2.15,
    USD: 1.27,
    CAD: 1.75,
    EUR: 1.17
  };

  const FALLBACK_LOCALES = {
    GBP: 'en-GB',
    ZAR: 'en-ZA',
    AUD: 'en-AU',
    NZD: 'en-NZ',
    USD: 'en-US',
    CAD: 'en-CA',
    EUR: 'en-IE'
  };

  const DEFAULT_CONFIG = {
    country: 'GB',
    currency: 'GBP',
    symbol: '£',
    locale: 'en-GB',
    region: 'United Kingdom',
    base_currency: 'GBP',
    rate_from_gbp: 1,
    approximate: false,
    note: 'Prices are shown in GBP.'
  };

  let cachedConfig = null;

  function format(amount, currency, locale) {
    try {
      return new Intl.NumberFormat(locale || FALLBACK_LOCALES[currency] || 'en-GB', {
        style: 'currency',
        currency: currency || 'GBP',
        maximumFractionDigits: amount >= 100 ? 0 : 2
      }).format(amount);
    } catch {
      const symbol = currency === 'GBP' ? '£' : `${currency || 'GBP'} `;
      return `${symbol}${Number(amount || 0).toFixed(2)}`;
    }
  }

  function convert(gbpAmount, config) {
    const currency = config?.currency || 'GBP';
    const rate = Number(config?.rate_from_gbp || FALLBACK_RATES[currency] || 1);
    return Number(gbpAmount || 0) * rate;
  }

  async function getConfig() {
    if (cachedConfig) return cachedConfig;

    try {
      const res = await fetch('/api/geo/currency', { credentials: 'same-origin' });
      const data = await res.json();
      if (res.ok && data?.currency) {
        cachedConfig = { ...DEFAULT_CONFIG, ...data };
        return cachedConfig;
      }
    } catch {}

    cachedConfig = DEFAULT_CONFIG;
    return cachedConfig;
  }

  async function apply(root = document) {
    const config = await getConfig();
    const nodes = root.querySelectorAll('[data-gbp]');
    nodes.forEach((node) => {
      const gbp = Number(node.dataset.gbp || 0);
      const suffix = node.dataset.priceSuffix || '';
      const localAmount = convert(gbp, config);
      const localLabel = format(localAmount, config.currency, config.locale);
      const gbpLabel = format(gbp, 'GBP', 'en-GB');

      if (config.currency === 'GBP') {
        node.textContent = `${gbpLabel}${suffix}`;
      } else {
        node.innerHTML = `${localLabel}${suffix} <span class="local-price-base">approx. ${gbpLabel}${suffix}</span>`;
      }
    });

    const notices = root.querySelectorAll('[data-currency-notice]');
    notices.forEach((node) => {
      if (config.currency === 'GBP') {
        node.textContent = 'Prices shown in GBP.';
      } else {
        node.textContent = `Prices shown approximately in ${config.currency} for ${config.region}. Checkout and card provider conversion are the final source of truth.`;
      }
    });

    return config;
  }

  return { getConfig, apply, format, convert };
})();

document.addEventListener('DOMContentLoaded', () => {
  window.PBICurrency?.apply();
});
