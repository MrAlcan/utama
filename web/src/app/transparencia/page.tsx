'use client';

import { useEffect, useState } from 'react';
import { Titulo } from '@/components/Motivos';
import { Cargando, Mensaje } from '@/components/ui';
import { obtenerConfig, obtenerMetricas, EXPLORER, type Metricas } from '@/lib/publico';
import type { Configuracion } from '@/lib/types';

const ETIQUETAS: Record<string, string> = {
  PENDIENTE_INSCRIPCION: 'Esperando inscripción',
  ACTIVO: 'Activos',
  EN_CHECKOUT: 'En check-out',
  EN_DISPUTA: 'En disputa',
  FINALIZADO: 'Finalizados',
  CANCELADO: 'Cancelados',
};

const num = (n: number) => n.toLocaleString('es-BO', { maximumFractionDigits: 2 });
const corto = (s: string) => `${s.slice(0, 6)}…${s.slice(-6)}`;

function Enlace({ href, texto }: { href: string; texto: string }) {
  return <a className="break-all font-mono text-sm text-terracota underline" href={href} target="_blank" rel="noreferrer">{texto}</a>;
}

export default function Transparencia() {
  const [m, setM] = useState<Metricas | null>(null);
  const [c, setC] = useState<Configuracion | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([obtenerMetricas(), obtenerConfig()])
      .then(([mm, cc]) => { setM(mm); setC(cc); })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar'));
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Titulo nivel={1}>Transparencia</Titulo>
        <p className="max-w-2xl text-suave">Cifras de la plataforma y las direcciones on-chain que cualquiera puede revisar.</p>
      </div>

      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!m && !error && <Cargando />}

      {m && (
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="card"><p className="text-sm text-suave">Retenido en escrow</p><p className="font-display text-2xl font-bold text-terracota">{num(m.retenidoEnEscrowUsdc)} USDC</p></div>
          <div className="card"><p className="text-sm text-suave">Folios verificados</p><p className="font-display text-2xl font-bold">{m.foliosVerificados}</p></div>
          <div className="card"><p className="text-sm text-suave">Comisiones Utama</p><p className="font-display text-2xl font-bold">{num(m.comisionesUsdc)} USDC</p></div>
          <div className="card sm:col-span-3">
            <p className="mb-2 text-sm font-bold">Contratos por estado</p>
            <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {Object.entries(ETIQUETAS).map(([k, t]) => (
                <li key={k} className="flex justify-between rounded-md border-2 border-borde px-3 py-2"><span>{t}</span><b>{m.contratosPorEstado[k] ?? 0}</b></li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {c && (
        <section className="card space-y-3">
          <Titulo nivel={2}>En la cadena</Titulo>
          {c.red !== 'testnet' && <Mensaje tipo="info">Modo demo sin cadena: los datos de abajo se activan en testnet.</Mensaje>}
          <dl className="grid gap-3 text-sm sm:grid-cols-[12rem_1fr]">
            <dt className="text-suave">Red</dt><dd>{c.red === 'testnet' ? 'Stellar testnet' : 'Demo (mock)'}</dd>
            {c.contratoFolios && (<><dt className="text-suave">Contrato utama-folios</dt><dd><Enlace href={`${EXPLORER}/contract/${c.contratoFolios}`} texto={corto(c.contratoFolios)} /></dd></>)}
            {c.tesoro && (<><dt className="text-suave">Cuenta del tesoro</dt><dd><Enlace href={`${EXPLORER}/account/${c.tesoro}`} texto={corto(c.tesoro)} /></dd></>)}
            {c.usdc && (<><dt className="text-suave">Activo</dt><dd>USDC de Circle · emisor <Enlace href={`${EXPLORER}/account/${c.usdc.issuer}`} texto={corto(c.usdc.issuer)} /></dd></>)}
            {c.escala && (<><dt className="text-suave">Escala de la demo</dt><dd>1:{c.escala.toLocaleString('es-BO')} (los montos en pantalla se dividen por {c.escala.toLocaleString('es-BO')} en la cadena)</dd></>)}
            <dt className="text-suave">Comisiones</dt><dd>Comisión Utama {c.comisionPlataformaPct} % + {c.comisionTwPct ?? 0.3} % de Trustless Work por liberación</dd>
          </dl>
        </section>
      )}
    </div>
  );
}
