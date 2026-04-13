import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const AuthContext = createContext(null);

const API_BASE = '';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...options.headers,
    },
    credentials: 'include',
  });
  return res;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef(null);

  // Schedule token refresh 1 minute before expiry (14 min)
  const scheduleRefresh = useCallback((delayMs = 14 * 60 * 1000) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        await refreshAccessToken();
      } catch {
        // Token expired, user will be redirected to login
        setUser(null);
        setOrg(null);
        setAccessToken(null);
      }
    }, delayMs);
  }, []);

  const refreshAccessToken = useCallback(async () => {
    const res = await apiFetch('/auth/refresh', { method: 'POST' });
    if (!res.ok) {
      setUser(null);
      setOrg(null);
      setAccessToken(null);
      return null;
    }
    const data = await res.json();
    setUser(data.user);
    setOrg(data.org);
    setAccessToken(data.accessToken);
    scheduleRefresh();
    return data.accessToken;
  }, [scheduleRefresh]);

  // Try to restore session on mount (guard against React strict mode double-fire)
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    refreshAccessToken().finally(() => setIsLoading(false));
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Login failed');
    }
    const data = await res.json();
    setUser(data.user);
    setOrg(data.org);
    setAccessToken(data.accessToken);
    scheduleRefresh();
    return data;
  }, [scheduleRefresh]);

  const register = useCallback(async (orgName, email, password, name) => {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ orgName, email, password, name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Registration failed');
    }
    const data = await res.json();
    setUser(data.user);
    setOrg(data.org);
    setAccessToken(data.accessToken);
    scheduleRefresh();
    return data;
  }, [scheduleRefresh]);

  const acceptInvite = useCallback(async (token, password, name) => {
    const res = await apiFetch('/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token, password, name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to accept invitation');
    }
    const data = await res.json();
    setUser(data.user);
    setOrg(data.org);
    setAccessToken(data.accessToken);
    scheduleRefresh();
    return data;
  }, [scheduleRefresh]);

  const logout = useCallback(async () => {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    setOrg(null);
    setAccessToken(null);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  /**
   * Authenticated fetch wrapper. Automatically adds Bearer token.
   * On 401 TOKEN_EXPIRED, tries one refresh and retries.
   */
  const authFetch = useCallback(async (path, options = {}) => {
    const doFetch = (token) =>
      fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
        credentials: 'include',
      });

    let res = await doFetch(accessToken);

    if (res.status === 401) {
      // Try refreshing
      const newToken = await refreshAccessToken();
      if (newToken) {
        res = await doFetch(newToken);
      }
    }

    return res;
  }, [accessToken, refreshAccessToken]);

  const value = {
    user,
    org,
    accessToken,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    acceptInvite,
    logout,
    authFetch,
    refreshAccessToken,
    setUser,
    setOrg,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
