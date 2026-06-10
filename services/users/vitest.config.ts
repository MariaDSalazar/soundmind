import { defineConfig } from 'vitest/config';

// Cobertura ENFOCADA al dominio + aplicación (la lógica de negocio): los
// adaptadores de infraestructura y las rutas se cubren con tests de integración,
// no aquí. Umbral 80% (roadmap §13 "tests >80% en dominio"); CI falla si baja.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/application/**', 'src/domain/**'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
