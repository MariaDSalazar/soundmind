import type { MusicProvider } from '../domain/ports.js';
import { JamendoAdapter } from './jamendo.adapter.js';
import { AudiusAdapter } from './audius.adapter.js';

/**
 * PATTERN: Factory Method — construye los proveedores disponibles según
 * la configuración del entorno. Si falta la key de Jamendo, el servicio
 * arranca igual solo con Audius (degradación elegante).
 */
export function createProviders(env: NodeJS.ProcessEnv): MusicProvider[] {
  const providers: MusicProvider[] = [];

  if (env.JAMENDO_CLIENT_ID && env.JAMENDO_CLIENT_ID !== 'tu_client_id_aqui') {
    providers.push(new JamendoAdapter(env.JAMENDO_CLIENT_ID));
  }
  providers.push(new AudiusAdapter(env.AUDIUS_APP_NAME ?? 'soundmind'));

  return providers;
}
