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
  baseURL: process.env.EXPO_PUBLIC_API_URL || API_CONFIG.baseUrl,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    // 'ngrok-skip-browser-warning': 'true',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await readStoredToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      await clearStoredToken();
    }

    return Promise.reject(error);
  }
);

const unwrap = (response) => response.data;

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
  const response = await api.post('/api/login', { email, password });
  return unwrap(response);
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
  const response = await api.get('/api/conversations');
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

// Compatibility export for existing auth context usage.
export const authService = {
  login: async ({ email, password }) => login(email, password),
  logout: async () => logout(),
};

