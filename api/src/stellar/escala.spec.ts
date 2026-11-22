import { describe, expect, it } from 'vitest';
import { pantallaAStroops, pantallaAUsdc, stroopsAPantalla, stroopsAUsdc } from './escala.js';

describe('escala', () => {
  it('30.000 pantalla -> 30 USDC -> 300_000_000 stroops', () => {
    expect(pantallaAUsdc(30000, 1000)).toBe(30);
    expect(pantallaAStroops(30000, 1000)).toBe(300_000_000n);
    expect(stroopsAUsdc(300_000_000n)).toBe('30.0000000');
    expect(stroopsAPantalla(300_000_000n, 1000)).toBe(30000);
  });
  it('sin errores de redondeo con decimales', () => {
    expect(pantallaAStroops(25200, 1000)).toBe(252_000_000n);
    expect(pantallaAStroops(0.1 + 0.2, 1)).toBe(3_000_000n);
    expect(pantallaAStroops(4486.5, 1000)).toBe(44_865_000n);
    expect(stroopsAUsdc(1n)).toBe('0.0000001');
  });
  it('rechaza escala inválida', () => {
    expect(() => pantallaAStroops(1, 0)).toThrow();
  });
});
