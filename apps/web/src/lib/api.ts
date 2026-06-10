import type { HistoryPage, Like, ListenEventInput, SearchResponse } from '@soundmind/shared';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

export interface AuthTokens {
  accessToken: string;
  expiresInS: number;
}

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  consentTracking: boolean;
}

/** Lanza un Error con el `title` del Problem Details (RFC 9457) del backend. */
async function unwrap<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  // Algunas respuestas no son JSON (p. ej. 429 "Too many requests" en texto
  // plano); no reventar al parsear.
  let body: { title?: string } | null = null;
  try {
    body = text ? (JSON.parse(text) as { title?: string }) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    if (res.status === 429) throw new Error('Demasiadas solicitudes — espera un momento e inténtalo de nuevo.');
    throw new Error(body?.title ?? text.trim() ?? `Error ${res.status}`);
  }
  return body as T;
}

function authHeaders(token: string): HeadersInit {
  return { authorization: `Bearer ${token}` };
}

// ── Catálogo (F1) ────────────────────────────────────────
export async function searchTracks(query: string): Promise<SearchResponse> {
  const url = new URL(`${API_URL}/tracks/search`);
  url.searchParams.set('q', query);
  return unwrap(await fetch(url));
}

// ── Auth (F1, ahora usada por la UI) ─────────────────────
export async function register(email: string, password: string, displayName: string): Promise<AuthTokens> {
  return unwrap(
    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include', // recibe la cookie HttpOnly de refresh
      body: JSON.stringify({ email, password, displayName }),
    }),
  );
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  return unwrap(
    await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    }),
  );
}

/** Restaura la sesión desde la cookie de refresh (al recargar la página). */
export async function refresh(): Promise<AuthTokens> {
  return unwrap(await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' }));
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
}

export async function getProfile(token: string): Promise<Profile> {
  return unwrap(await fetch(`${API_URL}/me`, { headers: authHeaders(token) }));
}

export async function setConsent(token: string, consentTracking: boolean): Promise<{ consentTracking: boolean }> {
  return unwrap(
    await fetch(`${API_URL}/me/consent`, {
      method: 'PUT',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ consentTracking }),
    }),
  );
}

// ── F2: likes ────────────────────────────────────────────
export async function getLikes(token: string): Promise<Like[]> {
  const { likes } = await unwrap<{ likes: Like[] }>(
    await fetch(`${API_URL}/me/likes`, { headers: authHeaders(token) }),
  );
  return likes;
}

export async function addLike(token: string, trackId: string): Promise<Like> {
  return unwrap(
    await fetch(`${API_URL}/me/likes/${encodeURIComponent(trackId)}`, {
      method: 'PUT',
      headers: authHeaders(token),
    }),
  );
}

export async function removeLike(token: string, trackId: string): Promise<void> {
  return unwrap(
    await fetch(`${API_URL}/me/likes/${encodeURIComponent(trackId)}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    }),
  );
}

// ── F2: historial y eventos ──────────────────────────────
export async function getHistory(token: string, cursor?: string): Promise<HistoryPage> {
  const url = new URL(`${API_URL}/me/history`);
  if (cursor) url.searchParams.set('cursor', cursor);
  return unwrap(await fetch(url, { headers: authHeaders(token) }));
}

export async function recordListenEvent(token: string, event: ListenEventInput): Promise<void> {
  await fetch(`${API_URL}/me/listen-events`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'content-type': 'application/json' },
    body: JSON.stringify(event),
  });
}
