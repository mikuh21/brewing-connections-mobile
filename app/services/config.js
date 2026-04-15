import { Platform } from 'react-native';

const localHost = Platform.select({
  android: '10.0.2.2',
  default: '127.0.0.1',
});

const fallbackBaseUrl = `http://${localHost}:8000`;
const runtimeBaseUrl = process.env.EXPO_PUBLIC_API_URL || fallbackBaseUrl;

export const API_CONFIG = {
  baseUrl: runtimeBaseUrl,
  endpoints: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
  },
};
