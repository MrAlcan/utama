import Link from 'next/link';
import { fechaCorta, usdc } from '@/lib/format';
import type { Inmueble } from '@/lib/types';
import { Insignias, Nivel, TipoEtiqueta } from './ui';

const CONTRATO: Record<string, string> = {
  ANTICRETICO: 'Anticrético',
};

export function InmuebleCard({ i }: { i: Inmueble }) {
  const ocupado = i.estado === 'EN_ANTICRETICO';
  return (
    <Link href={`/inmuebles/${i.id}`} className="card group flex flex-col overflow-hidden !p-0 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden bg-borde">
        {i.fotos[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={i.fotos[0].url} alt={i.titulo} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        )}
        <span className="absolute left-3 top-3 rounded-sm bg-tierra/90 px-2.5 py-1 text-xs font-bold text-lana">
          <TipoEtiqueta tipo={i.tipo} />
        </span>
        <span
          className={`absolute right-3 top-3 rounded-sm px-2.5 py-1 text-xs font-bold ${ocupado ? 'bg-oro text-tierra' : 'bg-lago text-white'}`}
        >
          {ocupado && i.ocupadoHasta ? `En anticrético hasta ${fechaCorta(i.ocupadoHasta)}` : 'Disponible'}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-lg font-bold leading-snug">{i.titulo}</h3>
          <p className="text-sm text-suave">
            {i.zona}, {i.ciudad} · {i.superficieM2} m²
            {i.dormitorios > 0 && ` · ${i.dormitorios} dorm.`}
          </p>
        </div>
        <Insignias i={i} />
        <div className="mt-auto flex items-end justify-between border-t-2 border-dashed border-borde pt-3">
          <div>
            <p className="text-xs text-suave">{CONTRATO[i.tipoContrato] ?? i.tipoContrato} · {i.plazoMeses / 12} {i.plazoMeses === 12 ? 'año' : 'años'}</p>
            <p className="font-display text-2xl font-bold text-terracota">{usdc(i.montoUsdc)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-suave">Dueño</p>
            <p className="text-sm font-semibold">{i.dueno.nombre}</p>
            <Nivel nivel={i.dueno.nivel} />
          </div>
        </div>
      </div>
    </Link>
  );
}
