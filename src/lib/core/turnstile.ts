/**
 * Cloudflare Turnstile verification helper
 *
 * Validates the Turnstile token from the client before performing server-side work.
 */

export interface TurnstileVerifyResult {
	success: boolean;
	'error-codes'?: string[];
	challenge_ts?: string;
	hostname?: string;
	action?: string;
	cdata?: string;
}

/**
 * Verify a Turnstile token against Cloudflare's verify endpoint.
 * Returns true when valid; false otherwise.
 */
export async function verifyTurnstile(
	token: string,
	secret: string,
	remoteIp?: string
): Promise<boolean> {
	try {
		const params = new URLSearchParams();
		params.set('secret', secret);
		params.set('response', token);
		if (remoteIp) params.set('remoteip', remoteIp);

		const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: params
		});

		if (!res.ok) return false;
		const data = (await res.json()) as TurnstileVerifyResult;
		return Boolean(data?.success);
	} catch (err) {
		console.error('Turnstile verify error:', err);
		return false;
	}
}
