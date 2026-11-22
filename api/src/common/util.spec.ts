import { describe, expect, it } from 'vitest';
import { ESTADOS_VIGENTES, hashFolio, normalizarFolio } from './util.js';

describe('vectores compartidos TS <-> Rust (X-02)', () => {
  it('hashFolio coincide con el vector del contrato utama-folios', () => {
    const esperado = '6fc1fc68c15a3fc6bf6eea29837c17ad935d7c11cd679236a8075a83b752ac6f';
    expect(normalizarFolio('7.01.1.99.0012345')).toBe('7011990012345');
    expect(hashFolio('7.01.1.99.0012345')).toBe(esperado);
    expect(hashFolio('70119 90012345')).toBe(esperado);
  });
  it('un folio con contrato pendiente de inscripción sigue bloqueado', () => {
    expect(ESTADOS_VIGENTES).toContain('PENDIENTE_INSCRIPCION');
  });
});
