import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities } from './decode-entities.js';

describe('decodeHtmlEntities', () => {
  it('decodifica entidades con nombre (caso real de Jamendo)', () => {
    expect(decodeHtmlEntities('Etude &quot;The Passion&quot;')).toBe('Etude "The Passion"');
    expect(decodeHtmlEntities('Rock &amp; Roll')).toBe('Rock & Roll');
    expect(decodeHtmlEntities('L&apos;amour')).toBe("L'amour");
  });

  it('decodifica entidades numéricas decimales y hexadecimales', () => {
    expect(decodeHtmlEntities('Caf&#233;')).toBe('Café');
    expect(decodeHtmlEntities('A&#x2014;B')).toBe('A—B');
  });

  it('deja intacto el texto sin entidades o con entidades desconocidas', () => {
    expect(decodeHtmlEntities('Sin entidades')).toBe('Sin entidades');
    expect(decodeHtmlEntities('&desconocida;')).toBe('&desconocida;');
  });
});
