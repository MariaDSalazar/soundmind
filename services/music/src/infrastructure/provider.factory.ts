import type { MusicProvider } from '../domain/ports.js';
import { JamendoAdapter } from './jamendo.adapter.js';
import { AudiusAdapter } from './audius.adapter.js';
import { ArchiveAdapter } from './archive.adapter.js';

/**
 * PATTERN: Factory Method — construye los proveedores disponibles según
 * la configuración del entorno. Si falta la key de Jamendo, el servicio
 * arranca igual con el resto (degradación elegante).
 *
 * Todas las fuentes son streaming COMPLETO y LEGAL (Creative Commons /
 * dominio público). El orden define la prioridad al intercalar (round-robin).
 *
 * Nota histórica (decisiones registradas en ADRs): se evaluaron y descartaron
 * fuentes comerciales — Deezer (previews 30s, ADR-006/010), ccMixter (latencia
 * 10-15s), Free Music Archive (API discontinuada) y JioSaavn (ADR-009/011: su
 * catálogo solo cubre música india; para latino/occidental devuelve covers).
 * Se mantiene únicamente catálogo libre para preservar el principio §2.
 */
export function createProviders(env: NodeJS.ProcessEnv): MusicProvider[] {
  const providers: MusicProvider[] = [];

  if (env.JAMENDO_CLIENT_ID && env.JAMENDO_CLIENT_ID !== 'tu_client_id_aqui') {
    providers.push(new JamendoAdapter(env.JAMENDO_CLIENT_ID));
  }
  providers.push(new AudiusAdapter(env.AUDIUS_APP_NAME ?? 'soundmind'));
  providers.push(new ArchiveAdapter());

  return providers;
}
