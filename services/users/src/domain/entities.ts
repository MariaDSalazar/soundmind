/**
 * Entidades de dominio del Users service — sin dependencias de infraestructura
 * (Hexagonal: el dominio no sabe que existen Postgres ni Redis).
 *
 * Los tipos públicos (ListenEvent, Like, HistoryPage…) viven en
 * @soundmind/shared porque también los consume el frontend. Aquí solo se
 * re-exportan para que las capas internas los importen desde el dominio.
 */
export type {
  ListenEvent,
  ListenEventInput,
  ListenEventType,
  Like,
  HistoryPage,
} from '@soundmind/shared';
