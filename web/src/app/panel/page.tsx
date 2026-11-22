'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { InmuebleCard } from '@/components/InmuebleCard';
import { MisVisitas } from '@/components/MisVisitas';
import { IconoNivel } from '@/components/Iconos';
import { Chakana, Titulo } from '@/components/Motivos';
import { PagoVerificacionPollar } from '@/components/PollarSesion';
import { Barra, Cargando, EstadoContratoBadge, Estrellas, Mensaje, Nivel } from '@/components/ui';
import { api, mensajeError } from '@/lib/api';
import { fechaCorta, NIVELES, usdc } from '@/lib/format';
import type { Contrato, Inmueble, Oferta, Reputacion, Visita } from '@/lib/types';
import { useUsuario } from '@/lib/usuario';

export default function Panel() {
  const { usuario, recargar } = useUsuario();
  const [contratos, setContratos] = useState<Contrato[] | null>(null);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [propios, setPropios] = useState<Inmueble[]>([]);
  const [rep, setRep] = useState<Reputacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState('');

  const cargar = useCallback(async () => {
    if (!usuario) return;
    try {
      const [c, v, o, p, r] = await Promise.all([
        api.get<Contrato[]>(`/contratos?usuarioId=${usuario.id}`),
        api.get<Visita[]>(`/visitas?usuarioId=${usuario.id}`),
        api.get<Oferta[]>(`/ofertas?usuarioId=${usuario.id}`),
        api.get<Inmueble[]>(`/inmuebles?duenoId=${usuario.id}`),
        api.get<Reputacion>(`/usuarios/${usuario.id}/reputacion`),
      ]);
      setContratos(c);
      setVisitas(v);
      setOfertas(o);
      setPropios(p);
      setRep(r);
      setError(null);
    } catch (e) {
      setError(mensajeError(e));
    }
  }, [usuario]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  async function guardarWallet() {
    if (!usuario || !wallet) return;
    try {
      await api.patch(`/usuarios/${usuario.id}/wallet`, { wallet });
      setWallet('');
      await recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  async function responder(id: string, estado: 'ACEPTADA' | 'RECHAZADA') {
    await api.patch(`/ofertas/${id}`, { estado });
    await cargar();
  }

  if (!usuario) return <Cargando />;
  if (contratos === null && !error) return <Cargando />;

  return (
    <div className="space-y-8">
      {!usuario.identidadVerificada && (
        <Mensaje tipo="info">
          Tu identidad todavía no está verificada: no puedes publicar ni tomar un anticrético.{' '}
          <Link href="/registro" className="font-bold underline">Verificar ahora</Link>.
        </Mensaje>
      )}

      <div className="card grid gap-5 md:grid-cols-[1fr_auto]">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Hola, {usuario.nombre}</h1>
          <p className="text-suave">
            <span className="inline-flex items-center gap-1.5 align-middle"><IconoNivel nivel={usuario.nivel} className="h-4 w-4" />{NIVELES[usuario.nivel] ?? usuario.nivel}</span> · identidad {usuario.identidadVerificada ? 'verificada' : 'pendiente'} · reside en {usuario.paisResidencia}
          </p>
          <p className="break-all text-xs text-suave">Wallet Stellar: {usuario.wallet ?? 'sin asociar'}</p>
          {rep && (
            <div className="flex flex-wrap items-center gap-3 pt-2 text-sm">
              <Estrellas valor={Math.round(rep.promedio ?? 0)} />
              <span className="font-semibold">
                {rep.promedio ? `${rep.promedio} de 5` : 'Sin calificaciones todavía'} · {rep.totalCalificaciones} {rep.totalCalificaciones === 1 ? 'reseña' : 'reseñas'} · {rep.contratosCumplidos} {rep.contratosCumplidos === 1 ? 'contrato cumplido' : 'contratos cumplidos'}
              </span>
            </div>
          )}
          {rep && rep.recientes.length > 0 && (
            <ul className="space-y-1 pt-2 text-sm text-suave">
              {rep.recientes.map((r) => (
                <li key={r.id}>“{r.comentario ?? `${r.estrellas} estrellas`}” — {r.de.nombre}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-2 text-sm">
          <div className="rounded-md bg-oro-claro px-4 py-3">
            <p className="flex items-center gap-1.5 font-bold"><Chakana className="h-3.5 w-3.5 text-terracota" /> Ahorro en Vaquita</p>
            <p className="font-display text-xl font-bold">{usuario.ahorroVaquita > 0 ? usdc(usuario.ahorroVaquita) : 'Sin datos'}</p>
            <p className="text-xs text-suave">Dato de ejemplo (integración pendiente)</p>
          </div>
        </div>
      </div>

      <PagoVerificacionPollar />

      <div className="card space-y-2">
        <p className="label">Asociar wallet Stellar (la entrega Pollar o Freighter)</p>
        <div className="flex gap-2">
          <input className="input" placeholder="G…" value={wallet} onChange={(e) => setWallet(e.target.value)} />
          <button className="btn btn-sec" onClick={guardarWallet}>Guardar</button>
        </div>
      </div>

      {error && <Mensaje tipo="error">{error}</Mensaje>}

      <section className="space-y-3">
        <Titulo>Mis contratos</Titulo>
        {contratos?.length === 0 && <p className="text-sm text-suave">Todavía no tienes contratos. <Link className="font-bold text-terracota underline" href="/">Explora los inmuebles</Link>.</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {contratos?.map((c) => (
            <Link key={c.id} href={`/contratos/${c.id}`} className="card space-y-3 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{c.inmueble.titulo}</p>
                  <p className="text-xs text-suave">
                    {c.inquilinoId === usuario.id ? `Dueño: ${c.dueno.nombre}` : `Inquilino: ${c.inquilino.nombre}`} · vence {fechaCorta(c.vencimiento)}
                  </p>
                </div>
                <EstadoContratoBadge estado={c.estado} />
              </div>
              <Barra garantia={c.garantiaUsdc} aportes={c.devueltoUsdc} total={c.montoUsdc} />
              <p className="text-xs text-suave">
                Devolución asegurada: {usdc(c.retenidoUsdc)} de {usdc(c.montoUsdc)} ({c.progresoPct}%)
              </p>
            </Link>
          ))}
        </div>
      </section>


      <section className="space-y-3">
        <Titulo>Mis visitas</Titulo>
        <MisVisitas visitas={visitas} onCambio={cargar} />
      </section>

      <section className="space-y-3">
        <Titulo>Ofertas</Titulo>
        {ofertas.length === 0 && <p className="text-sm text-suave">No hay ofertas.</p>}
        {ofertas.map((o) => {
          const esDueno = o.inmueble.duenoId === usuario.id;
          return (
            <div key={o.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold">{o.inmueble.titulo}</p>
                <p className="text-sm text-suave">
                  {esDueno ? `${o.inquilino.nombre} ofrece` : 'Tu oferta:'} {usdc(o.montoUsdc)} por {o.plazoMeses} meses
                </p>
              </div>
              {o.estado === 'PENDIENTE' && esDueno ? (
                <div className="flex gap-2">
                  <button className="btn btn-andino !py-1.5" onClick={() => responder(o.id, 'ACEPTADA')}>Aceptar</button>
                  <button className="btn btn-peligro !py-1.5" onClick={() => responder(o.id, 'RECHAZADA')}>Rechazar</button>
                </div>
              ) : (
                <Link href={`/inmuebles/${o.inmueble.id}`} className="text-sm font-bold capitalize text-terracota underline">{o.estado.toLowerCase()}</Link>
              )}
            </div>
          );
        })}
      </section>

      {propios.length > 0 && (
        <section className="space-y-3">
          <Titulo>Mis inmuebles</Titulo>
          <Nivel nivel={usuario.nivel} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {propios.map((i) => <InmuebleCard key={i.id} i={i} />)}
          </div>
        </section>
      )}
    </div>
  );
}
