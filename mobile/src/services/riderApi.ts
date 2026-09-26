import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/api';

/**
 * Authenticated requests for the rider app, with automatic token renewal.
 *
 * A rider logs in once and keeps the app for weeks, but the access token lasts
 * 7 days. Before this, every location push after day 7 came back 401 — and
 * because the screen never checked the response, it kept showing a fresh
 * "Last update" while nothing reached the server. Now a 401 triggers one
 * refresh (the server's /auth/refresh supports riders) and a single retry.
 *
 * Plain fetch rather than the shared `api` client on purpose: that client
 * clears all tokens when a refresh fails, which would silently log a rider out
 * mid-delivery. Here a failed refresh is reported, not acted on.
 */

let refreshing: Promise<string | null> | null = null;

/** One refresh at a time — concurrent 401s share the same renewal. */
function refreshToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const refresh = await SecureStore.getItemAsync('refreshToken');
        if (!refresh) return null;
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: refresh }),
        });
        if (!res.ok) return null;
        const body = await res.json();
        const access = body?.data?.accessToken;
        if (!access) return null;
        await SecureStore.setItemAsync('accessToken', access);
        if (body?.data?.refreshToken) await SecureStore.setItemAsync('refreshToken', body.data.refreshToken);
        return access as string;
      } catch {
        return null;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

async function send(path: string, init: RequestInit | undefined, token: string | null) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
}

/** Raw response, after at most one token renewal. */
export async function riderRequest(path: string, init?: RequestInit): Promise<Response> {
  const res = await send(path, init, await SecureStore.getItemAsync('accessToken'));
  if (res.status !== 401) return res;
  const fresh = await refreshToken();
  return fresh ? send(path, init, fresh) : res;
}

/**
 * Parsed `data`, throwing a readable error on any failure — including the
 * statuses plain fetch treats as success (401, 429, 500…).
 */
export async function riderJson(path: string, init?: RequestInit) {
  const res = await riderRequest(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(
      res.status === 401
        ? 'Your session has expired. Log out and log in again.'
        : body?.message || `Request failed (${res.status})`,
    );
    err.status = res.status;
    throw err;
  }
  return body?.data;
}
