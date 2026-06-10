import { create } from 'zustand';
import * as api from '../lib/api';
import type { Profile } from '../lib/api';

/**
 * Sesión del usuario. El access token vive SOLO en memoria (no en localStorage)
 * para reducir superficie de XSS; el refresh token va en cookie HttpOnly y
 * `restore()` reconstruye la sesión al recargar la página.
 */
interface AuthState {
  token: string | null;
  profile: Profile | null;
  ready: boolean; // true cuando ya se intentó restaurar la sesión
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
  setConsent: (value: boolean) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  profile: null,
  ready: false,

  login: async (email, password) => {
    const { accessToken } = await api.login(email, password);
    set({ token: accessToken, profile: await api.getProfile(accessToken) });
  },

  register: async (email, password, displayName) => {
    const { accessToken } = await api.register(email, password, displayName);
    set({ token: accessToken, profile: await api.getProfile(accessToken) });
  },

  logout: async () => {
    await api.logout();
    set({ token: null, profile: null });
  },

  restore: async () => {
    try {
      const { accessToken } = await api.refresh();
      set({ token: accessToken, profile: await api.getProfile(accessToken), ready: true });
    } catch {
      set({ token: null, profile: null, ready: true });
    }
  },

  setConsent: async (value) => {
    const token = get().token;
    if (!token) return;
    await api.setConsent(token, value);
    const profile = get().profile;
    if (profile) set({ profile: { ...profile, consentTracking: value } });
  },
}));
