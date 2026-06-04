import express from 'express';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import { SearchTracksUseCase } from './application/search-tracks.js';
import { createProviders } from './infrastructure/provider.factory.js';
import { buildRoutes } from './interfaces/routes.js';

const logger = pino({ name: 'music-service' });

// Composición de dependencias (composition root): el dominio recibe
// sus puertos ya implementados — inversión de dependencias en práctica.
const providers = createProviders(process.env);
const searchTracks = new SearchTracksUseCase(providers);

const app = express();
app.disable('x-powered-by');
app.use(pinoHttp({ logger }));
app.use(buildRoutes(searchTracks));

const port = Number(process.env.MUSIC_PORT ?? 4002);
app.listen(port, () => {
  logger.info(
    { port, providers: providers.map((p) => p.source) },
    'Music service escuchando',
  );
  if (providers.length === 1) {
    logger.warn('JAMENDO_CLIENT_ID no configurado — solo Audius activo. Consigue una key gratis en https://devportal.jamendo.com/');
  }
});
