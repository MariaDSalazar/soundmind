/**
 * Tipos de dominio compartidos entre servicios y frontend.
 * Solo metadata de pistas: SoundMind nunca almacena audio (ver docs/ARQUITECTURA.md §5).
 */

/**
 * Fuentes de música legal soportadas:
 * Todas son streaming COMPLETO y legal:
 * - jamendo/audius: Creative Commons / artistas independientes
 * - archive: dominio público / netlabels (Internet Archive)
 */
export type TrackSource = 'jamendo' | 'audius' | 'archive';

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
  /** true si streamUrl es un preview oficial de 30s (catálogo comercial). */
  isPreview?: boolean;
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

// ── F2: Users service (perfil y eventos) ──────────────────────────

/** Tipos de evento de escucha (ver ARQUITECTURA.md §10). */
export type ListenEventType = 'play' | 'skip' | 'complete';

/** Evento de escucha que el cliente envía y que se publica en Redis Streams. */
export interface ListenEventInput {
  /** Id de pista `${source}:${sourceTrackId}`. */
  trackId: string;
  eventType: ListenEventType;
  /** Milisegundos reproducidos (para distinguir skip temprano de play completo). */
  playedMs: number;
  device?: string;
  /**
   * Snapshot inmutable de la pista al momento del evento (event sourcing): permite
   * reconstruir y reproducir el historial sin una tabla `tracks` (diferida a F3).
   */
  track?: Track;
}

/** Evento de escucha persistido / devuelto en el historial. */
export interface ListenEvent extends ListenEventInput {
  /** UUID; clave de idempotencia compartida entre Postgres y el stream (§8). */
  eventId: string;
  userId: string;
  /** Hora del día (0–23) derivada en servidor; señal contextual para la IA (§6.3). */
  contextHour: number;
  createdAt: string;
}

export interface Like {
  userId: string;
  trackId: string;
  createdAt: string;
}

/** Página cursor-based del historial (ARQUITECTURA.md §8). */
export interface HistoryPage {
  events: ListenEvent[];
  /** Cursor opaco para la siguiente página; null si no hay más. */
  nextCursor: string | null;
}

// ── F3: Recommender service (IA de contenido) ─────────────────────

/**
 * Explicabilidad de una recomendación (§6.5): la UI lo traduce a un texto como
 * "Porque escuchaste X". Diferenciador frente a las cajas negras comerciales.
 */
export interface RecommendationReason {
  /**
   * "similar_track" (vecino de un ancla) | "taste" (centroide de gustos, F3) |
   * "collaborative" (ALS, "oyentes como tú", F4).
   */
  type: 'similar_track' | 'taste' | 'collaborative';
  /** Señal usada: "tags" | "content" (texto) | "als" (colaborativo). */
  signal: string;
  /** trackId ancla cuando type === "similar_track". */
  anchor?: string | null;
  /** Nota contextual (§6.3), p.ej. afinidad de hora; null si no aplica. */
  context?: string | null;
}

/** Pista recomendada: un `Track` enriquecido con score [0..1] y su explicación. */
export interface RecommendedTrack extends Track {
  /** Similitud coseno 0..1 (1 = idéntico en contenido). */
  score: number;
  reason: RecommendationReason;
}

/**
 * Respuesta de "Para ti". `onboarded=false` → la UI muestra el onboarding de
 * géneros (cold start, §6.6) en vez de una lista vacía.
 */
export interface ForMeResponse {
  onboarded: boolean;
  tracks: RecommendedTrack[];
}

/** Entrada del onboarding: 3–5 géneros elegidos por el usuario. */
export interface OnboardingInput {
  genres: string[];
}

/** Resultado del onboarding. `tasteSeeded=false` si aún no había corpus embebido. */
export interface OnboardingResult {
  onboarded: boolean;
  tasteSeeded: boolean;
}
