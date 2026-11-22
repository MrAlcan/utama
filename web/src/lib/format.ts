export const usdc = (n: number) =>
  `${n.toLocaleString('es-BO', { maximumFractionDigits: 2 })} USDC`;

export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-BO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });

export const diaClave = (iso: string) => {
  const t = new Date(iso).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });

export const corto = (s: string, n = 10) => (s.length > n * 2 + 1 ? `${s.slice(0, n)}…${s.slice(-6)}` : s);

export const TIPOS: { clave: string; etiqueta: string }[] = [
  { clave: '', etiqueta: 'Todos' },
  { clave: 'VIVIENDA', etiqueta: 'Vivienda' },
  { clave: 'LOCAL', etiqueta: 'Local' },
  { clave: 'OFICINA', etiqueta: 'Oficina' },
  { clave: 'GALPON', etiqueta: 'Galpón' },
];

export const etiquetaTipo = (t: string) => TIPOS.find((x) => x.clave === t)?.etiqueta ?? t;

export const NIVELES: Record<string, string> = {
  NUEVO_VERIFICADO: 'Nuevo verificado',
  BRONCE: 'Bronce',
  PLATA: 'Plata',
  ORO: 'Oro',
};

const STELLAR_EXPERT_TESTNET = 'https://stellar.expert/explorer/testnet';

export const urlTx = (hash: string) => `${STELLAR_EXPERT_TESTNET}/tx/${hash}`;

export const urlContrato = (cAddr: string) => `${STELLAR_EXPERT_TESTNET}/contract/${cAddr}`;

export const urlCuenta = (gAddr: string) => `${STELLAR_EXPERT_TESTNET}/account/${gAddr}`;
