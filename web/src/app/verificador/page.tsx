'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Bloque } from '@/components/Bloque';
import { Cargando, EstadoContratoBadge, Mensaje } from '@/components/ui';
import { anticretico } from '@/lib/anticretico';
import { api, mensajeError } from '@/lib/api';
import { fechaCorta, usdc } from '@/lib/format';
import type { Contrato } from '@/lib/types';
import { useUsuario } from '@/lib/usuario';

export default function PaginaVerificador() {
  const { usuario } = useUsuario();
  const [pendientes, setPendientes] = useState<Contrato[] | null>(null);
  const [enCheckout, setEnCheckout] = useState<Contrato[] | null>(null);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const esVerificador = usuario?.rol === 'VERIFICADOR';

  const cargar = useCallback(async () => {
    if (!esVerificador) return;
    try {
      const [p, ch] = await Promise.all([
        anticretico.contratosPorEstado('PENDIENTE_INSCRIPCION'),
        anticretico.contratosPorEstado('EN_CHECKOUT'),
      ]);
      setPendientes(p);
      setEnCheckout(ch);
      setError(null);
    } catch (e) {
      setError(mensajeError(e));
    }
  }, [esVerificador]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  async function ejecutar(contratoId: string, fn: () => Promise<unknown>, ok: string) {
    setOcupadoId(contratoId);
    setError(null);
    setAviso(null);
    try {
      await fn();
      setAviso(ok);
      await cargar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupadoId(null);
    }
  }

  async function confirmar(c: Contrato, archivo?: File) {
    if (!usuario || !archivo) return;
    await ejecutar(
      c.id,
      async () => {
        const docUrl = await api.subirFoto(archivo);
        return anticretico.confirmarInscripcion(c, usuario.id, docUrl);
      },
      `Inscripción confirmada para "${c.inmueble.titulo}".`,
    );
  }

  async function cancelar(c: Contrato) {
    if (!usuario) return;
    if (!confirm(`¿Cancelar "${c.inmueble.titulo}" y reembolsar ${usdc(c.montoUsdc)} a ${c.inquilino.nombre}?`)) return;
    await ejecutar(
      c.id,
      () => anticretico.cancelar(c, usuario.id),
      `Contrato cancelado y reembolsado a ${c.inquilino.nombre}.`,
    );
  }

  async function aprobar(c: Contrato) {
    if (!usuario) return;
    await ejecutar(
      c.id,
      () => anticretico.aprobarCheckout(c, usuario.id),
      `Garantía liberada y contrato "${c.inmueble.titulo}" finalizado.`,
    );
  }

  if (!usuario) return <Cargando />;

  if (!esVerificador) {
    return (
      <Mensaje tipo="info">
        Esta vista es para el verificador de Utama. Elige &apos;Verificadora Utama&apos; en el selector.
      </Mensaje>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Panel del verificador</h1>
        <p className="text-sm text-suave">
          Confirma inscripciones en Derechos Reales, cancela contratos vencidos sin inscripción y libera garantías al cerrar el check-out.
        </p>
      </div>

      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {aviso && <Mensaje tipo="ok">{aviso}</Mensaje>}

      <Bloque icono="reloj" titulo="Esperando inscripción" descripcion="Contratos con depósito retenido en escrow esperando folio inscrito en DDRR.">
        {pendientes === null ? (
          <Cargando />
        ) : pendientes.length === 0 ? (
          <p className="text-sm text-suave">No hay contratos esperando inscripción.</p>
        ) : (
          <div className="space-y-3">
            {pendientes.map((c) => {
              const bloqueado = ocupadoId !== null;
              return (
                <div key={c.id} className="space-y-3 rounded-md border-2 border-borde bg-crema p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/contratos/${c.id}`} className="font-bold text-terracota underline">
                        {c.inmueble.titulo}
                      </Link>
                      <p className="text-xs text-suave">
                        Dueño: {c.dueno.nombre} · Inquilino: {c.inquilino.nombre}
                      </p>
                      {c.limiteInscripcion && (
                        <p className="text-xs text-suave">Límite de inscripción: {fechaCorta(c.limiteInscripcion)}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <EstadoContratoBadge estado={c.estado} />
                      <p className="mt-1 font-bold">{usdc(c.montoUsdc)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className={`btn btn-andino cursor-pointer !py-1.5 ${bloqueado ? 'pointer-events-none opacity-60' : ''}`}>
                      Confirmar inscripción
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        disabled={bloqueado}
                        onChange={(e) => {
                          void confirmar(c, e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-peligro !py-1.5"
                      disabled={bloqueado}
                      onClick={() => void cancelar(c)}
                    >
                      Cancelar y reembolsar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Bloque>

      <Bloque icono="puerta" titulo="En check-out" descripcion="Contratos listos para liberar la garantía una vez devuelto el capital.">
        {enCheckout === null ? (
          <Cargando />
        ) : enCheckout.length === 0 ? (
          <p className="text-sm text-suave">No hay contratos en check-out.</p>
        ) : (
          <div className="space-y-3">
            {enCheckout.map((c) => {
              const bloqueado = ocupadoId !== null;
              return (
                <div key={c.id} className="space-y-3 rounded-md border-2 border-borde bg-crema p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/contratos/${c.id}`} className="font-bold text-terracota underline">
                        {c.inmueble.titulo}
                      </Link>
                      <p className="text-xs text-suave">
                        Dueño: {c.dueno.nombre} · Inquilino: {c.inquilino.nombre}
                      </p>
                      <p className="text-xs text-suave">Vencimiento: {fechaCorta(c.vencimiento)}</p>
                    </div>
                    <div className="text-right">
                      <EstadoContratoBadge estado={c.estado} />
                      <p className="mt-1 font-bold">{usdc(c.montoUsdc)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-primario !py-1.5"
                      disabled={bloqueado}
                      onClick={() => void aprobar(c)}
                    >
                      Liberar garantía y cerrar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Bloque>
    </div>
  );
}
