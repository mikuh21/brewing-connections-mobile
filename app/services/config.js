const runtimeBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://brewing-hub.online';

export const API_CONFIG = {
  baseUrl: runtimeBaseUrl,
  endpoints: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
  },
};
