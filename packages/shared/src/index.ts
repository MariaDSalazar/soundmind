/**
 * Tipos de dominio compartidos entre servicios y frontend.
 * Solo metadata de pistas: SoundMind nunca almacena audio (ver docs/ARQUITECTURA.md §5).
 */

/** Fuentes de música legal soportadas (Creative Commons / artistas independientes). */
export type TrackSource = 'jamendo' | 'audius';

export interface Track {
  /** Id interno: `${source}:${sourceTrackId}` */
  id: string;
  source: TrackSource;
  sourceTrackId: string;
  title: string;
  artist: string;
  durationS: number;
  /** URL oficial de streaming del CDN del proveedor — nunca se hace proxy del audio. */
  streamUrl: string;
  artworkUrl: string | null;
  genreTags: string[];
}

export interface SearchResponse {
  query: string;
  tracks: Track[];
  /** Fuentes que respondieron OK (resiliencia: una fuente caída no rompe la búsqueda). */
  sources: TrackSource[];
}

export interface AuthTokens {
  accessToken: string;
  /** El refresh token viaja en cookie HttpOnly, nunca en el body. */
  expiresInS: number;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
}

/** Error estándar RFC 9457 (Problem Details). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
}
