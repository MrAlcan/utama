/**
 * Escenarios de aceptación AT-00..AT-07 (docs/ACEPTACION.md) contra la API, del lado del backend.
 * Lo visual (cajas, insignias, pestañas) queda para la checklist manual M1-M13 del Dev-2.
 * Uso: cd api && API_URL=http://localhost:3001/api DEMO_RESET_TOKEN=... npx tsx ../scripts/aceptacion-testnet.ts
 * Gasta USDC de testnet (a escala) de MARIA y DIEGO; el reembolso y el check-out lo devuelven casi todo.
 */
const API = (process.env.API_URL ?? 'http://localhost:3001/api').replace(/\/+$/, '');
const HORIZON = 'https://horizon-testnet.stellar.org';
const res: { at: string; ok: boolean; nota: string }[] = [];

async function http(method: string, ruta: string, body?: unknown, headers: Record<string, string> = {}) {
  const r = await fetch(`${API}${ruta}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: any = await r.json().catch(() => ({}));
  return { status: r.status, data };
}
const post = (ruta: string, body: unknown = {}, h?: Record<string, string>) => http('POST', ruta, body, h);
const get = (ruta: string) => http('GET', ruta);
function check(at: string, ok: boolean, nota: string) {
  res.push({ at, ok, nota });
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${at.padEnd(6)} ${nota}`);
}
async function usdc(g: string): Promise<number> {
  const a: any = await (await fetch(`${HORIZON}/accounts/${g}`)).json();
  const cfg = (await get('/config')).data;
  const b = (a.balances ?? []).find((x: any) => x.asset_code === 'USDC' && x.asset_issuer === cfg.usdc.issuer);
  return Number(b?.balance ?? 0);
}
const conTx = (c: any) => (c?.eventos ?? []).filter((e: any) => e.txHash && !String(e.txHash).startsWith('mock_'));

const cfg = (await get('/config')).data;
if (cfg.red !== 'testnet') throw new Error(`La API no está en testnet (red=${cfg.red})`);
const E = cfg.escala as number;
const usuarios: any[] = (await get('/usuarios')).data;
const G = (id: string) => usuarios.find((u) => u.id === id)?.wallet as string;
const tok = process.env.DEMO_RESET_TOKEN ? { 'x-demo-token': process.env.DEMO_RESET_TOKEN } : {};

// AT-00 · Demo reiniciable
{
  const r1 = await post('/demo/reset', {}, tok);
  const r2 = await post('/demo/reset', {}, tok);
  const inm = (await get('/inmuebles')).data as any[];
  const libres = inm.filter((i) => i.estado === 'PUBLICADO').length;
  check('AT-00', [200, 201, 429].includes(r1.status), `reset ${r1.status}; ${libres}/${inm.length} inmuebles publicados`);
  check('AT-00', r2.status === 429 && r2.data.codigo === 'RESET_ENFRIAMIENTO', `2.º reset ${r2.status} ${r2.data.codigo ?? ''}: "${r2.data.message ?? ''}"`);
  const ests = await Promise.all(['inm-1', 'inm-2'].map(async (id) => (await get(`/inmuebles/${id}`)).data));
  for (const i of ests) {
    if (!i.folioHash) continue;
    const f = (await get(`/folio/${i.folioHash}/estado`)).data;
    check('AT-00', f.ocupado === false, `folio de ${i.id} libre (BD): ocupado=${f.ocupado}`);
  }
}

// AT-01 · Verificación del folio
{
  const h = await post('/folio/verificar', { folioNumero: '7.01.1.99.0099001', escenario: 'HIPOTECA' });
  check('AT-01', h.data.verificado === false && !!h.data.motivo, `hipoteca rechazada: "${h.data.motivo}"`);
  const n = `7.01.1.99.${String(Date.now()).slice(-7)}`;
  const p = await post('/inmuebles', {
    duenoId: 'u-carlos', titulo: 'AT-01 departamento', descripcion: 'Prueba de aceptación', tipo: 'VIVIENDA',
    ciudad: 'Santa Cruz', zona: 'Equipetrol', direccion: 'Calle AT 1', latitud: -17.76, longitud: -63.19,
    superficieM2: 80, montoUsdc: 30000, folioNumero: n, escenarioFolio: 'LIMPIO',
  });
  check('AT-01', p.status === 201 && !!p.data.atestadoTx, `publicado ${p.status}; atestar_folio tx=${p.data.atestadoTx ?? p.data.message}`);
}

// AT-02 · Visita y oferta (off-chain)
let oferta: any;
{
  const antes = (await get('/inmuebles/inm-1?usuarioId=u-maria')).data;
  // Horario lejano y aleatorio para no cruzarse con los slots del seed ni con corridas anteriores.
  const ini = new Date(Date.now() + (40 + Math.floor(Math.random() * 300)) * 86_400_000);
  const s = await post('/inmuebles/inm-1/disponibilidad', { slots: [{ inicio: ini.toISOString(), fin: new Date(ini.getTime() + 3_600_000).toISOString() }] });
  const slots = (await get('/inmuebles/inm-1/disponibilidad')).data as any[];
  const v = await post('/visitas', { disponibilidadId: slots.at(-1)?.id, inquilinoId: 'u-maria' });
  const o = await post('/ofertas', { inmuebleId: 'inm-1', inquilinoId: 'u-maria', montoUsdc: 30000, plazoMeses: 24 });
  const a = await http('PATCH', `/ofertas/${o.data.id}`, { estado: 'ACEPTADA' });
  oferta = a.data;
  const despues = (await get('/inmuebles/inm-1?usuarioId=u-maria')).data;
  check('AT-02', s.status < 300 && v.status < 300 && a.data.estado === 'ACEPTADA', `slots ${s.status}, visita ${v.status}, oferta ${o.status}→${a.data.estado}`);
  check('AT-02', !antes.direccionVisible && despues.direccionVisible, `dirección visible: antes=${antes.direccionVisible} después=${despues.direccionVisible}`);
}

// AT-03 · Tomar en anticrético
let cM: any;
{
  const carlos0 = await usdc(G('u-carlos'));
  const r = await post('/contratos', { inmuebleId: 'inm-1', inquilinoId: 'u-maria', montoUsdc: oferta?.montoUsdc ?? 30000, plazoMeses: oferta?.plazoMeses ?? 24, garantiaPct: 15 });
  cM = r.data;
  const tipos = conTx(cM).map((e: any) => e.tipo);
  check('AT-03', r.status === 201 && cM.estado === 'PENDIENTE_INSCRIPCION', `crear ${r.status} → ${cM.estado ?? cM.codigo}; límite ${cM.limiteInscripcion}`);
  check('AT-03', ['ESCROW_CREADO', 'FOLIO_BLOQUEADO', 'DEPOSITO'].every((t) => tipos.includes(t)), `tx on-chain: ${tipos.join(', ')}`);
  const oc = (await get(`/contratos/${cM.id}/onchain`)).data;
  check('AT-03', Math.abs(oc.saldoEscrowUsdc - 30000) < 1, `escrow retiene ${oc.saldoEscrowUsdc} (pantalla)`);
  check('AT-03', (cM.pagadoDuenoUsdc ?? 0) === 0 && Math.abs((await usdc(G('u-carlos'))) - carlos0) < 1e-7, `pagado al dueño ${cM.pagadoDuenoUsdc ?? 0}; saldo de Carlos sin cambios`);
}

// AT-04 · Doble anticrético
{
  const d0 = await usdc(G('u-diego'));
  const r = await post('/contratos', { inmuebleId: 'inm-1', inquilinoId: 'u-diego' });
  check('AT-04', r.status === 409 && r.data.codigo === 'FOLIO_OCUPADO' && r.data.onchain === true, `${r.status} ${r.data.codigo} onchain=${r.data.onchain}`);
  check('AT-04', Math.abs((await usdc(G('u-diego'))) - d0) < 1e-7, 'Diego no gastó USDC');
}

// AT-05 · Inscripción
{
  const c0 = await usdc(G('u-carlos'));
  const r = await post(`/contratos/${cM.id}/inscripcion`, { verificadorId: 'u-verificador', numeroInscripcion: 'DDRR-AT-05', docUrl: 'https://example.com/folio.pdf' });
  const recibido = ((await usdc(G('u-carlos'))) - c0) * E;
  check('AT-05', r.data.estado === 'ACTIVO', `estado ${r.data.estado ?? r.data.codigo}; pagadoDueno ${r.data.pagadoDuenoUsdc}, comisión ${r.data.comisionUsdc}, garantía ${r.data.garantiaUsdc}`);
  check('AT-05', Math.abs(recibido - 25200 * 0.997) < 2, `Carlos recibió ${recibido.toFixed(1)} (esperado 25.200 − 0,3 % = 25.124,4)`);
}

// AT-06 · Cancelación y reembolso
{
  const d0 = await usdc(G('u-diego'));
  const r = await post('/contratos', { inmuebleId: 'inm-2', inquilinoId: 'u-diego' });
  const monto = r.data.montoUsdc;
  const k = await post(`/contratos/${r.data.id}/cancelar`, { verificadorId: 'u-verificador', motivo: 'AT-06 sin inscripción' });
  const neto = ((await usdc(G('u-diego'))) - d0) * E;
  const inm = (await get('/inmuebles/inm-2')).data;
  const ocK = (await get(`/contratos/${r.data.id}/onchain`)).data;
  check('AT-06', ocK.folioOcupado === false, `folio de inm-2 on-chain ocupado=${ocK.folioOcupado}`);
  check('AT-06', k.data.estado === 'CANCELADO', `crear ${r.data.estado ?? r.data.codigo} → cancelar ${k.data.estado ?? k.data.codigo}`);
  check('AT-06', Math.abs(neto + monto * 0.003) < 2, `Diego perdió ${(-neto).toFixed(1)} de ${monto} (esperado 0,3 % = ${(monto * 0.003).toFixed(1)})`);
  check('AT-06', inm.estado === 'PUBLICADO', `inmueble inm-2 vuelve a ${inm.estado}`);
}

// AT-07 · Check-out y cierre
{
  const items = [{ ambiente: 'Living', estado: 'BUENO' }];
  await http('PUT', `/contratos/${cM.id}/inventario/CHECKIN`, { items });
  await post(`/contratos/${cM.id}/inventario/CHECKIN/firmar`, { rol: 'INQUILINO' });
  await post(`/contratos/${cM.id}/inventario/CHECKIN/firmar`, { rol: 'DUENO' });
  const m0 = await usdc(G('u-maria'));
  const i = await post(`/contratos/${cM.id}/checkout/iniciar`);
  const d = await post(`/contratos/${cM.id}/devolucion`, {});
  const a = await post(`/contratos/${cM.id}/checkout/aprobar`, { verificadorId: 'u-verificador' });
  const recibido = ((await usdc(G('u-maria'))) - m0) * E;
  const oc = (await get(`/contratos/${cM.id}/onchain`)).data;
  check('AT-07', a.data.estado === 'FINALIZADO', `iniciar ${i.data.estado ?? i.data.codigo}, devolver ${d.data.devueltoUsdc ?? d.data.codigo}, aprobar ${a.data.estado ?? a.data.codigo}`);
  check('AT-07', Math.abs(recibido - (25500 + 4500 * 0.997)) < 2, `María recibió ${recibido.toFixed(1)} (esperado 25.500 + 4.500 − 0,3 % = 29.986,5)`);
  check('AT-07', oc.folioOcupado === false && oc.saldoEscrowUsdc === 0, `folio on-chain ocupado=${oc.folioOcupado}; escrow ${oc.saldoEscrowUsdc}`);
}

const fallas = res.filter((r) => !r.ok);
console.log(`\n${res.length - fallas.length}/${res.length} comprobaciones OK`);
process.exit(fallas.length ? 1 : 0);
