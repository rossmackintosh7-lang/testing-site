export async function verifyTurnstileDetailed(env, token, remoteIp = '') {
  const secret =
    env.TURNSTILE_SECRET_KEY ||
    env.CF_TURNSTILE_SECRET_KEY ||
    env.CLOUDFLARE_TURNSTILE_SECRET_KEY ||
    '';

  if (!secret) {
    return {
      success: false,
      reason: 'TURNSTILE_SECRET_KEY is missing from Cloudflare Pages Variables and Secrets.',
      code: 'missing-secret',
      errorCodes: ['missing-secret']
    };
  }

  if (!token) {
    return {
      success: false,
      reason: 'Turnstile token was not sent from the browser.',
      code: 'missing-token',
      errorCodes: ['missing-input-response']
    };
  }

  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (remoteIp) form.append('remoteip', remoteIp);

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form
    });

    const data = await response.json().catch(() => ({}));
    const errorCodes = data['error-codes'] || data.error_codes || [];

    if (!data.success) {
      let reason = 'Turnstile server verification failed.';

      if (errorCodes.includes('invalid-input-secret')) {
        reason = 'Turnstile secret key is wrong. Use the Secret Key from the same Turnstile widget as the site key on the login page.';
      } else if (errorCodes.includes('missing-input-secret')) {
        reason = 'Turnstile secret key was not received by Cloudflare verification.';
      } else if (errorCodes.includes('invalid-input-response')) {
        reason = 'Turnstile browser token was invalid. Refresh the page and complete the check again.';
      } else if (errorCodes.includes('timeout-or-duplicate')) {
        reason = 'Turnstile token expired or was already used. Refresh the page and try again.';
      } else if (errorCodes.includes('bad-request')) {
        reason = 'Turnstile verification request was malformed.';
      }

      return {
        success: false,
        reason,
        code: errorCodes[0] || 'verification-failed',
        errorCodes,
        hostname: data.hostname || '',
        challenge_ts: data.challenge_ts || ''
      };
    }

    return {
      success: true,
      hostname: data.hostname || '',
      challenge_ts: data.challenge_ts || ''
    };
  } catch (err) {
    return {
      success: false,
      reason: 'Could not contact Cloudflare Turnstile verification service.',
      code: 'network-error',
      errorCodes: ['network-error']
    };
  }
}

export async function verifyTurnstile(env, token, remoteIp = '') {
  const result = await verifyTurnstileDetailed(env, token, remoteIp);
  return Boolean(result.success);
}
