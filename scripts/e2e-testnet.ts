/**
 * B-14 caso 1 (testnet): reset -> crear (María) -> 2.º crear (Diego) = 409 FOLIO_OCUPADO onchain -> inscripción.
 * Uso: cd api && npm run e2e:testnet   (API local con ANTICRETICO_MODE=testnet; API_URL por defecto http://localhost:3001)
 */
const API = (process.env.API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
const link = (h: string) => `https://stellar.expert/explorer/testnet/tx/${h}`;
const tabla: [string, string][] = [];

async function http(method: string, ruta: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${API}${ruta}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
function hashes(o: unknown, acc: string[] = []): string[] {
  if (Array.isArray(o)) o.forEach((x) => hashes(x, acc));
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && /tx(hash)?$/i.test(k) && v && !v.startsWith('mock_')) acc.push(v);
      else hashes(v, acc);
    }
  }
  return acc;
}
function fallar(msg: string, extra?: unknown): never {
  console.error(`FALLÓ: ${msg}`, extra === undefined ? '' : JSON.stringify(extra));
  process.exit(1);
}
function paso(nombre: string, d: unknown) {
  const hs = [...new Set(hashes(d))];
  for (const h of hs) tabla.push([nombre, h]);
  console.log(`ok  ${nombre}${hs.length ? `  (${hs.length} tx)` : ''}`);
}

const cfg = await http('GET', '/config');
if (cfg.data?.red !== 'testnet') fallar('la API no está en modo testnet (GET /config -> red)', cfg.data);

const reset = await http('POST', '/demo/reset', undefined, process.env.DEMO_RESET_TOKEN ? { 'x-demo-token': process.env.DEMO_RESET_TOKEN } : {});
if (reset.status === 429) console.log('reset omitido (enfriamiento activo)');
else if (reset.status !== 201 && reset.status !== 200) fallar('reset', reset);
else {
  paso('reset', reset.data);
  if (reset.data.aviso) console.log(`aviso del reset: ${reset.data.aviso}`);
}

const c1 = await http('POST', '/contratos', { inmuebleId: 'inm-1', inquilinoId: 'u-maria' });
if (c1.status !== 201) fallar('crear (María)', c1);
paso('crear', c1.data);

const c2 = await http('POST', '/contratos', { inmuebleId: 'inm-1', inquilinoId: 'u-diego' });
if (c2.status !== 409 || c2.data.codigo !== 'FOLIO_OCUPADO' || c2.data.onchain !== true) fallar('el 2.º crear debía ser 409 FOLIO_OCUPADO con onchain:true', c2);
console.log('ok  2.º crear (Diego): 409 FOLIO_OCUPADO onchain:true');

const ins = await http('POST', `/contratos/${c1.data.id}/inscripcion`, { verificadorId: 'u-verificador', docUrl: 'https://example.com/folio-inscrito.pdf' });
if (ins.status !== 201 && ins.status !== 200) fallar('inscripción', ins);
if (ins.data.estado !== 'ACTIVO') fallar('el contrato no quedó ACTIVO', ins.data.estado);
paso('inscripción', ins.data);

console.log('\nPaso             txHash / enlace');
for (const [p, h] of tabla) console.log(`${p.padEnd(16)} ${h}\n${' '.repeat(17)}${link(h)}`);
console.log('\nE2E testnet caso 1: OK');

export {};
