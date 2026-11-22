/** Conversión monto de pantalla <-> USDC on-chain (DEMO_ESCALA) <-> stroops (7 decimales, bigint). */
const DEC = 10_000_000; // 1e7

function escalaValida(escala: number): bigint {
  if (!Number.isInteger(escala) || escala <= 0) throw new Error(`DEMO_ESCALA inválida: ${escala}`);
  return BigInt(escala);
}

export const pantallaAUsdc = (monto: number, escala: number) => monto / Number(escalaValida(escala));

/** stroops = round(monto * 1e7 / escala), aritmética entera. */
export function pantallaAStroops(monto: number, escala: number): bigint {
  const e = escalaValida(escala);
  const p7 = BigInt(Math.round(monto * DEC)); // monto de pantalla a 7 decimales
  return (p7 * 2n + e) / (2n * e);
}

/** Formatea stroops como decimal con 7 decimales exactos. */
export function stroopsAUsdc(stroops: bigint): string {
  const neg = stroops < 0n;
  const v = neg ? -stroops : stroops;
  const ent = v / BigInt(DEC);
  const dec = (v % BigInt(DEC)).toString().padStart(7, '0');
  return `${neg ? '-' : ''}${ent}.${dec}`;
}

export const stroopsAPantalla = (stroops: bigint, escala: number) => Number(stroopsAUsdc(stroops)) * Number(escalaValida(escala));
