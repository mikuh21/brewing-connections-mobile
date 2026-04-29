import { API_CONFIG } from '../services';

const PRODUCTION_WEB_BASE_URL = 'https://brewing-hub.online';

function normalizeWebBaseUrl(rawUrl) {
	const trimmed = String(rawUrl || '').trim();
	if (!trimmed) {
		return PRODUCTION_WEB_BASE_URL;
	}

	const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

	try {
		const parsed = new URL(withScheme);
		const host = String(parsed.hostname || '').toLowerCase();

		const isLocalHost =
			host === 'localhost' ||
			host === '127.0.0.1' ||
			host === '0.0.0.0' ||
			host.endsWith('.localhost') ||
			/^192\.168\./.test(host) ||
			/^10\./.test(host) ||
			/^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

		if (isLocalHost) {
			return PRODUCTION_WEB_BASE_URL;
		}

		return parsed.origin.replace(/\/+$/, '');
	} catch {
		return PRODUCTION_WEB_BASE_URL;
	}
}

export function buildMarketplaceLandingReservationUrl({ productId, quantity, prefillToken }) {
	const runtimeWebBase = process.env.EXPO_PUBLIC_WEB_URL || API_CONFIG?.baseUrl || PRODUCTION_WEB_BASE_URL;
	const baseUrl = normalizeWebBaseUrl(runtimeWebBase);

	const params = new URLSearchParams();
	if (Number.isInteger(Number(productId)) && Number(productId) > 0) {
		params.set('product_id', String(Number(productId)));
	}
	if (Number.isFinite(Number(quantity)) && Number(quantity) > 0) {
		params.set('quantity', String(Math.floor(Number(quantity))));
	}
	if (prefillToken) {
		params.set('prefill_token', String(prefillToken));
	}

	const query = params.toString();
	return `${baseUrl}/${query ? `?${query}` : ''}#farm-products`;
}
