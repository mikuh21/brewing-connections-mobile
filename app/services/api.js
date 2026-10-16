import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_CONFIG } from './config';

const AUTH_TOKEN_KEY = 'auth_token';
const LEGACY_SESSION_KEY = 'brewhub_auth';

async function readStoredToken() {
  const directToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (directToken) {
    return directToken;
  }

  const legacySession = await AsyncStorage.getItem(LEGACY_SESSION_KEY);
  if (!legacySession) {
    return null;
  }

  try {
    const parsed = JSON.parse(legacySession);
    return parsed?.token ?? null;
  } catch {
    return null;
  }
}

async function clearStoredToken() {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);

  const legacySession = await AsyncStorage.getItem(LEGACY_SESSION_KEY);
  if (!legacySession) {
    return;
  }

  try {
    const parsed = JSON.parse(legacySession);
    const updatedSession = { ...parsed, token: null };
    await AsyncStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(updatedSession));
  } catch {
    await AsyncStorage.removeItem(LEGACY_SESSION_KEY);
  }
}

export const api = axios.create({
  baseURL: API_CONFIG.baseUrl,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    // 'ngrok-skip-browser-warning': 'true',
  },
});

api.interceptors.request.use(async (config) => {
  const resolvedBaseUrl = String(config?.baseURL || api.defaults.baseURL || '').replace(/\/+$/, '');
  const resolvedPath = String(config?.url || '');
  const resolvedUrl = /^https?:\/\//i.test(resolvedPath)
    ? resolvedPath
    : `${resolvedBaseUrl}${resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`}`;

  const token = await readStoredToken();

  console.log('[API REQUEST]', {
    method: String(config?.method || 'get').toUpperCase(),
    url: api.getUri(config) || resolvedUrl,
    baseURL: config?.baseURL || api.defaults.baseURL || '',
    path: resolvedPath,
    authenticated: Boolean(token),
  });

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requestUrl = error?.config
      ? api.getUri(error.config)
      : '';
    const authorizationHeader =
      error?.config?.headers?.get?.('Authorization') ??
      error?.config?.headers?.Authorization ??
      error?.config?.headers?.authorization;

    console.log('[API RESPONSE ERROR]', {
      message: error?.message,
      code: error?.code,
      method: String(error?.config?.method || '').toUpperCase(),
      url: requestUrl,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      authenticated: Boolean(authorizationHeader),
    });

    if (error?.response?.status === 401) {
      await clearStoredToken();
    }

    return Promise.reject(error);
  }
);

const unwrap = (response) => response.data;

export function getApiErrorMessage(error, action = 'complete this request') {
  const status = error?.response?.status;
  const responseData = error?.response?.data;
  const serverMessage =
    typeof responseData?.message === 'string' ? responseData.message.trim() : '';

  if (status === 401) {
    return 'Your session has expired. Please log in again.';
  }
  if (status === 403) {
    return 'Your account is not permitted to complete this request.';
  }
  if (status === 404) {
    return (
      serverMessage ||
      'The saved Coffee Trail or location-check endpoint could not be found or is not available to this account. Reopen a saved trail and retry.'
    );
  }
  if (status === 422) {
    const validationErrors = Object.values(responseData?.errors || {})
      .flat()
      .filter((message) => typeof message === 'string' && message.trim());
    return validationErrors.join(' ') || serverMessage || 'The server rejected this location check.';
  }
  if (status >= 500) {
    return `The server could not ${action}. Please retry in a moment.`;
  }
  if (!error?.response) {
    if (error?.code === 'ERR_NETWORK' || error?.request) {
      return 'Unable to reach BrewHub. Check your connection and retry.';
    }
    return error?.message || `Unable to ${action}. Please retry.`;
  }

  return serverMessage || `Unable to ${action}. Please retry.`;
}

function normalizeLocationChecksResponse(response) {
  const payload =
    response && !Array.isArray(response) && response.status !== undefined && response.data !== undefined
      ? response.data
      : response;
  const checks = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.checks)
        ? payload.checks
        : Array.isArray(payload?.data?.data)
          ? payload.data.data
          : null;

  if (!checks) {
    throw new Error('BrewHub returned an unexpected location-check response.');
  }

  return checks.map((check) => {
    const reviewStatus = String(check?.review_status || '').toLowerCase();

    return {
      ...check,
      trail_id: check?.trail_id ?? check?.coffee_trail_id ?? null,
      needs_review:
        check?.needs_review ??
        ['flagged', 'needs_review', 'pending', 'pending_review', 'reported', 'under_review'].includes(
          reviewStatus
        ),
    };
  });
}

function shouldUseNetworkFallback(error) {
  return error?.code === 'ERR_NETWORK' && !error?.response;
}

async function getWithFetchFallback(path) {
  const resolvedBaseUrl = String(api.defaults.baseURL || '').replace(/\/+$/, '');
  const resolvedPath = String(path || '');
  const resolvedUrl = /^https?:\/\//i.test(resolvedPath)
    ? resolvedPath
    : `${resolvedBaseUrl}${resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`}`;

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  const token = await readStoredToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(resolvedUrl, {
    method: 'GET',
    headers,
  });

  const rawBody = await response.text();
  const parsedBody = rawBody ? JSON.parse(rawBody) : null;

  if (!response.ok) {
    const fallbackError = new Error(parsedBody?.message || `Request failed with status ${response.status}`);
    fallbackError.response = {
      status: response.status,
      statusText: response.statusText,
      data: parsedBody,
      headers: {},
    };
    throw fallbackError;
  }

  return parsedBody;
}

async function getWithNetworkFallback(path) {
  try {
    const response = await api.get(path);
    return unwrap(response);
  } catch (error) {
    if (!shouldUseNetworkFallback(error)) {
      throw error;
    }

    console.log('[API FETCH FALLBACK]', {
      method: 'GET',
      path,
    });

    return getWithFetchFallback(path);
  }
}

async function postWithFallback(paths, payload, config) {
  let lastError = null;

  for (const path of paths) {
    try {
      const response = await api.post(path, payload, config);
      return unwrap(response);
    } catch (error) {
      const status = error?.response?.status;
      if (status !== 404 && status !== 405) {
        throw error;
      }
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('Unable to process request right now.');
}

export const login = async (email, password) => {
  const payload = { email, password };
  const resolvedBaseUrl = String(api.defaults.baseURL || '').replace(/\/+$/, '');
  const resolvedUrl = `${resolvedBaseUrl}/api/login`;

  console.log('[LOGIN REQUEST]', {
    url: resolvedUrl,
    payload,
  });

  try {
    const response = await api.post('/api/login', payload);
    return unwrap(response);
  } catch (error) {
    console.log('[LOGIN ERROR]', {
      message: error?.message,
      code: error?.code,
      url: resolvedUrl,
      payload,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      headers: error?.response?.headers,
      requestHeaders: error?.config?.headers,
    });

    throw error;
  }
};

export const register = async (name, email, password) => {
  const response = await api.post('/api/register', { name, email, password });
  return unwrap(response);
};

export const logout = async () => {
  const response = await api.post('/api/logout');
  return unwrap(response);
};

export const getEstablishments = async () => {
  const response = await api.get('/api/mobile/establishments/geojson');
  return unwrap(response);
};

export const getEstablishment = async (id) => {
  const response = await api.get(`/api/establishments/${id}`);
  return unwrap(response);
};

export const getCoffeeTrail = async (preferences) => {
  const response = await api.post('/api/coffee-trail/generate', preferences);
  return unwrap(response);
};

export const getCoffeeTrailPreview = async (payload) => {
  const response = await api.post('/api/coffee-trail/preview', payload);
  return unwrap(response);
};

export const getCoffeeTrailHistory = async () => {
  const response = await api.get('/api/coffee-trail/history');
  return unwrap(response);
};

export const getLocationChecks = async (trailId) => {
  if (trailId !== undefined && trailId !== null && !/^[1-9]\d*$/.test(String(trailId).trim())) {
    throw new Error('A valid saved Coffee Trail ID is required to load its location checks.');
  }

  const response = await api.get('/api/location-checks', {
    params: trailId ? { trail_id: trailId } : undefined,
  });
  return normalizeLocationChecksResponse(unwrap(response));
};

export const submitLocationCheck = async (trailId, data) => {
  if (!/^[1-9]\d*$/.test(String(trailId ?? '').trim())) {
    throw new Error('A valid saved Coffee Trail ID is required to submit a location check.');
  }

  const response = await api.post(`/api/coffee-trails/${trailId}/location-checks`, data);
  const result = unwrap(response);
  return result?.data ?? result;
};

export const trackMapMarkerView = async (data) => {
  const response = await api.post('/api/coffee-trail/marker-view', data);
  return unwrap(response);
};

export const getCouponPromos = async (params = {}) => {
  const response = await api.get('/api/coupon-promos', {
    params,
  });
  return unwrap(response);
};

export const verifyCouponPromoQr = async (data) => {
  const response = await api.post('/api/coupon-promos/verify-qr', data);
  return unwrap(response);
};

export const getProducts = async () => {
  const response = await api.get('/api/products');
  return unwrap(response);
};

export const placeOrder = async (data) => {
  const response = await api.post('/api/orders', data);
  return unwrap(response);
};

export const getMyOrders = async () => {
  const response = await api.get('/api/orders');
  return unwrap(response);
};

export const updateOrderStatus = async (orderId, status) => {
  const response = await api.patch(`/api/orders/${orderId}`, { status });
  return unwrap(response);
};

export const submitRating = async (data) => {
  const hasPhoto = Boolean(data?.photo?.uri);

  if (hasPhoto) {
    const formData = new FormData();
    formData.append('establishment_id', String(data.establishment_id));
    formData.append('taste_rating', String(data.taste_rating));
    formData.append('environment_rating', String(data.environment_rating));
    formData.append('cleanliness_rating', String(data.cleanliness_rating));
    formData.append('service_rating', String(data.service_rating));

    formData.append('photo', {
      uri: data.photo.uri,
      type: data.photo.type || 'image/jpeg',
      name: data.photo.name || `rating-${Date.now()}.jpg`,
    });

    const response = await api.post('/api/ratings', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return unwrap(response);
  }

  const response = await api.post('/api/ratings', {
    establishment_id: data.establishment_id,
    taste_rating: data.taste_rating,
    environment_rating: data.environment_rating,
    cleanliness_rating: data.cleanliness_rating,
    service_rating: data.service_rating,
  });
  return unwrap(response);
};

export const getRatingsFeed = async () => {
  const response = await api.get('/api/ratings');
  return unwrap(response);
};

export const getMessages = async () => {
  return getWithNetworkFallback('/api/conversations');
};

export const getConversationMessages = async (conversationId) => {
  return getWithNetworkFallback(`/api/conversations/${conversationId}/messages`);
};

export const getChatRecipients = async () => {
  return getWithNetworkFallback('/api/chat/recipients');
};

export const createConversation = async (recipientId) => {
  const response = await api.post('/api/conversations', {
    recipient_id: recipientId,
  });
  return unwrap(response);
};

export const markConversationAsRead = async (conversationId) => {
  const response = await api.post(`/api/conversations/${conversationId}/read`);
  return unwrap(response);
};

export const sendMessage = async (data) => {
  const response = await api.post('/api/messages', data);
  return unwrap(response);
};

export const getProfile = async () => {
  const response = await api.get('/api/profile');
  return unwrap(response);
};

export const updateProfile = async (data) => {
  const response = await api.put('/api/profile', data);
  return unwrap(response);
};

export const requestPasswordReset = async (email) => {
  return api.post('/api/password/forgot', { email }).then(unwrap);
};

export const resetPasswordWithOtp = async ({ email, otp, password, password_confirmation }) => {
  const response = await api.post('/api/password/reset', {
    email,
    otp,
    password,
    password_confirmation,
  });
  return unwrap(response);
};

export const sendEmailVerification = async (email) => {
  return postWithFallback(
    ['/api/email/verification-notification', '/email/verification-notification'],
    { email }
  );
};

export const verifyEmailOtp = async ({ email, otp }) => {
  const response = await api.post('/api/email/verify-otp', {
    email,
    otp,
  });
  return unwrap(response);
};

export const createLandingReservationPrefillToken = async (data = {}) => {
  const response = await api.post('/api/reservations/landing/prefill-token', data);
  return unwrap(response);
};

// Compatibility export for existing auth context usage.
export const authService = {
  login: async ({ email, password }) => login(email, password),
  logout: async () => logout(),
};
