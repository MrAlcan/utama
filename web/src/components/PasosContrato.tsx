import { etapaDelContrato, PASOS_CONTRATO } from '@/lib/contrato-ui';
import { urlTx } from '@/lib/format';
import type { Contrato } from '@/lib/types';
import { Icono } from './Iconos';

export { etapaDelContrato };

/** Barra de etapas: depósito en escrow → inscripción DDRR → check-in → vigencia → check-out → cierre. */
export function PasosContrato({ c }: { c: Contrato }) {
  if (c.estado === 'CANCELADO') {
    const reembolso = c.eventos?.find((e) => e.tipo === 'REEMBOLSO' && e.txHash);
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border-2 border-dashed border-borde bg-crema px-4 py-3 text-sm">
        <p className="flex items-center gap-2 font-semibold text-suave">
          <Icono nombre="equis" className="h-4 w-4 text-peligro" />
          Cancelado: el dinero volvió a {c.inquilino.nombre}.
        </p>
        {c.modo === 'testnet' && reembolso?.txHash && (
          <a
            className="text-xs font-bold text-andino underline"
            href={urlTx(reembolso.txHash)}
            target="_blank"
            rel="noreferrer"
          >
            Ver reembolso en stellar.expert ↗
          </a>
        )}
      </div>
    );
  }

  const actual = etapaDelContrato(c);
  return (
    <ol className="flex items-start" aria-label="Etapas del contrato">
      {PASOS_CONTRATO.map((t, i) => {
        const hecho = i < actual;
        const ahora = i === actual;
        return (
          <li key={t} className="relative flex flex-1 flex-col items-center gap-1.5 text-center" aria-current={ahora ? 'step' : undefined}>
            {i > 0 && (
              <span
                className={`absolute right-1/2 top-3.5 h-0.5 w-full ${i <= actual ? 'bg-lago' : 'bg-borde'}`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 grid h-7 w-7 place-items-center rounded-full border-2 text-xs font-bold ${
                hecho
                  ? 'border-lago bg-lago text-white'
                  : ahora
                    ? 'border-terracota bg-terracota-claro text-terracota-oscuro ring-4 ring-terracota/20'
                    : 'border-borde bg-papel text-suave'
              }`}
            >
              {hecho ? <Icono nombre="check" className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={`text-[11px] leading-tight sm:text-xs ${ahora ? 'font-bold text-tinta' : 'text-suave'}`}>{t}</span>
          </li>
        );
      })}
    </ol>
  );
}
