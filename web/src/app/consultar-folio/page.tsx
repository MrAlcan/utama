'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Titulo } from '@/components/Motivos';
import { Cargando, Mensaje } from '@/components/ui';
import { consultarFolio, obtenerConfig, EXPLORER, type ConsultaFolio } from '@/lib/publico';

export default function ConsultarFolio() {
  const [matricula, setMatricula] = useState('');
  const [res, setRes] = useState<ConsultaFolio | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [contrato, setContrato] = useState<string | null>(null);

  useEffect(() => {
    obtenerConfig().then((c) => setContrato(c.contratoFolios ?? null)).catch(() => {});
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!matricula.trim()) return;
    setCargando(true);
    setError('');
    setRes(null);
    try {
      setRes(await consultarFolio(matricula.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo consultar');
    } finally {
      setCargando(false);
    }
  }

  const estado = !res
    ? null
    : res.ocupado
      ? { clase: 'border-terracota bg-terracota/10 text-terracota', texto: 'Ocupado: tiene un anticrético vigente' }
      : res.verificado
        ? { clase: 'border-andino bg-andino-claro text-andino', texto: 'Libre y verificado' }
        : { clase: 'border-borde text-suave', texto: 'No registrado en Utama' };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <Titulo nivel={1}>Consultar folio</Titulo>
        <p className="text-suave">Antes de entregar tu dinero, revisa si el inmueble ya tiene un anticrético vigente dentro de Utama.</p>
      </div>

      <form onSubmit={enviar} className="card space-y-3">
        <label className="label" htmlFor="matricula">Número de matrícula del Folio Real</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="matricula" className="input flex-1" value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="Ej.: 2.01.0.99.0012345" autoComplete="off" />
          <button type="submit" className="btn btn-primario" disabled={cargando || !matricula.trim()}>Consultar</button>
        </div>
      </form>

      {cargando && <Cargando texto="Consultando…" />}
      {error && <Mensaje tipo="error">{error}</Mensaje>}

      {res && estado && (
        <section className="card space-y-3">
          <p className={`rounded-md border-2 px-4 py-3 text-lg font-bold ${estado.clase}`}>{estado.texto}</p>
          {res.inmueble && (
            <p className="text-sm">
              Inmueble: <Link className="font-semibold text-terracota underline" href={`/inmuebles/${res.inmueble.id}`}>{res.inmueble.titulo}</Link> · {res.inmueble.ciudad}
            </p>
          )}
          {res.onchain && (
            <p className="text-sm text-suave">
              En la cadena: {res.onchain.atestado ? `atestado, ${res.onchain.estado === 'Bloqueado' ? 'bloqueado' : 'libre'}` : 'sin atestar'}
              {res.onchain.explorer && <> · <a className="underline" href={res.onchain.explorer} target="_blank" rel="noreferrer">ver contrato</a></>}
            </p>
          )}
          <p className="break-all font-mono text-xs text-suave">Huella del folio: {res.folioHash}</p>
        </section>
      )}

      <p className="text-xs text-suave">
        Utama no reemplaza a Derechos Reales: esta consulta muestra si el folio está bloqueado dentro de Utama. En testnet, el registro vive en el contrato <code>utama-folios</code> de Stellar.
        {contrato && <> <a className="underline" href={`${EXPLORER}/contract/${contrato}`} target="_blank" rel="noreferrer">Ver en stellar.expert</a>.</>}
      </p>
    </div>
  );
}
