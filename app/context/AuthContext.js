import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';
const AuthContext = createContext(null);

function normalizeUser(userData) {
  if (!userData) {
    return null;
  }

  return {
    id: userData.id ?? null,
    name: userData.name ?? '',
    email: userData.email ?? '',
    profile_photo_url: userData.profile_photo_url ?? userData.profile_photo ?? userData.avatar ?? null,
    role: userData.role ?? null,
    email_verified_at: userData.email_verified_at ?? null,
    email_verified:
      userData.email_verified ?? userData.verified ?? Boolean(userData.email_verified_at),
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const hydrateAuth = async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(AUTH_TOKEN_KEY),
          AsyncStorage.getItem(AUTH_USER_KEY),
        ]);

        setToken(storedToken ?? null);
        setUser(storedUser ? normalizeUser(JSON.parse(storedUser)) : null);
      } catch (error) {
        console.warn('Failed to read auth session', error);
      } finally {
        setIsLoading(false);
      }
    };

    hydrateAuth();
  }, []);

  const login = async (nextToken, userData) => {
    const normalizedUser = normalizeUser(userData);

    await Promise.all([
      AsyncStorage.setItem(AUTH_TOKEN_KEY, nextToken),
      AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalizedUser)),
    ]);

    setToken(nextToken);
    setUser(normalizedUser);
  };

  const logout = async () => {
    await Promise.all([
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(AUTH_USER_KEY),
    ]);

    setToken(null);
    setUser(null);
  };

  const updateUser = async (userData) => {
    const normalizedUser = normalizeUser(userData);
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalizedUser));
    setUser(normalizedUser);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(token),
      login,
      logout,
      updateUser,
      // Compatibility aliases for existing screens.
      loading: isLoading,
      signIn: login,
      signOut: logout,
    }),
    [user, token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
