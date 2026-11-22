'use client';

import { useState } from 'react';
import { anticretico } from '@/lib/anticretico';
import { api, mensajeError } from '@/lib/api';
import { fechaCorta, usdc } from '@/lib/format';
import type { Contrato, Usuario } from '@/lib/types';
import { Bloque } from './Bloque';
import { Chakana } from './Motivos';
import { useReglas } from './ReglasInmueble';
import { Selector } from './Selector';
import { Estrellas, Mensaje } from './ui';

export type Rol = 'DUENO' | 'INQUILINO' | null;

const fila = (t: string, v: string) => (
  <div className="flex justify-between gap-3 text-sm">
    <span className="text-suave">{t}</span>
    <span className="text-right font-semibold">{v}</span>
  </div>
);

/** Resumen del contrato (M6): partes, inmueble, monto, moneda, plazo, reglas, garantía y plan de devolución. */
export function ResumenContrato({ c, plantilla }: { c: Contrato; plantilla?: string }) {
  return (
    <Bloque icono="documento" titulo="Resumen del contrato" descripcion="Lo que firmaron las dos partes.">
      <div className="space-y-2">
        {fila('Dueño', c.dueno.nombre)}
        {fila('Inquilino', c.inquilino.nombre)}
        {fila('Inmueble', `${c.inmueble.titulo}`)}
        {fila('Monto', usdc(c.montoUsdc))}
        {fila('Moneda de pago', c.metodoPago === 'BOB' ? `Bolivianos: ${c.montoBs?.toLocaleString('es-BO')} Bs (1 USDC = ${c.tipoCambio} Bs, simulado)` : 'USDC')}
        {fila('Plazo', `${c.plazoMeses} meses${c.renovaciones ? ` (renovado ${c.renovaciones} ${c.renovaciones === 1 ? 'vez' : 'veces'})` : ''}`)}
        {fila('Vigencia', `${fechaCorta(c.inicio)} a ${fechaCorta(c.vencimiento)}`)}
        {fila('Fondo de garantía inicial', usdc(c.montoUsdc - c.montoDuenoUsdc))}
        {plantilla && fila('Reglas', `Plantilla ${plantilla.toLowerCase()}`)}
        {c.penalidadUsdc > 0 && fila('Penalidad por salida anticipada', usdc(c.penalidadUsdc))}
      </div>
      <p className="text-xs text-suave">
        El contrato inteligente complementa al contrato tradicional: se recomienda notariarlo e inscribirlo en Derechos Reales.
      </p>
    </Bloque>
  );
}

/** Lógica común de las acciones: ocupado, error y aviso. */
function useAccion(alCambiar: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function correr(fn: () => Promise<unknown>, ok: string) {
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      await fn();
      setAviso(ok);
      alCambiar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }
  return { error, aviso, ocupado, correr };
}

const Resultado = ({ error, aviso }: { error: string | null; aviso: string | null }) => (
  <>
    {error && <Mensaje tipo="error">{error}</Mensaje>}
    {aviso && <Mensaje tipo="ok">{aviso}</Mensaje>}
  </>
);

const NotaTestnet = () =>
  anticretico.modo === 'testnet' ? (
    <p className="text-xs text-suave">Esta acción se registra en el backend; todavía no tiene una función equivalente en el contrato Soroban.</p>
  ) : null;

interface PropsAccion {
  c: Contrato;
  rol: Rol;
  alCambiar: () => void;
}

/** Renovación (función `renovar`): una parte propone, la otra acepta y el contrato continúa. */
export function Renovacion({ c, rol, alCambiar }: PropsAccion) {
  const { error, aviso, ocupado, correr } = useAccion(alCambiar);
  const [plazo, setPlazo] = useState('12');
  const [nota, setNota] = useState('');
  const ren = c.renovacion;
  const faltaMiRespuesta = !!ren && !!rol && (rol === 'DUENO' ? !ren.aceptaDueno : !ren.aceptaInquilino);

  return (
    <Bloque
      icono="repetir"
      titulo="Renovar el contrato"
      descripcion="Una parte propone un plazo adicional y la otra lo acepta. El contrato continúa sin devolver ni volver a depositar."
    >
      <NotaTestnet />
      <Resultado error={error} aviso={aviso} />

      {c.estado !== 'ACTIVO' && <p className="text-sm text-suave">Solo se puede renovar un contrato activo.</p>}

      {c.estado === 'ACTIVO' && !rol && <p className="text-sm text-suave">Solo las partes del contrato pueden proponer una renovación.</p>}

      {c.estado === 'ACTIVO' && rol && !ren && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="ren-plazo">Plazo adicional</label>
            <Selector
              id="ren-plazo"
              className="w-40"
              valor={plazo}
              onCambio={setPlazo}
              opciones={[
                { valor: '12', etiqueta: '12 meses' },
                { valor: '24', etiqueta: '24 meses' },
                { valor: '36', etiqueta: '36 meses' },
              ]}
            />
          </div>
          <div className="min-w-48 flex-1">
            <label className="label">Condiciones (opcional)</label>
            <input className="input" placeholder="Ej.: mismas reglas, mismo precio" value={nota} onChange={(e) => setNota(e.target.value)} />
          </div>
          <button
            className="btn btn-andino"
            disabled={ocupado}
            onClick={() => correr(() => api.post(`/contratos/${c.id}/renovacion/proponer`, { plazoMeses: Number(plazo), propuestoPor: rol, nota: nota || undefined }), 'Propuesta de renovación enviada.')}
          >
            Proponer renovación
          </button>
        </div>
      )}

      {c.estado === 'ACTIVO' && ren && (
        <div className="space-y-3 rounded-md bg-crema p-4 text-sm">
          <p className="font-semibold">
            Propuesta: renovar {ren.plazoMeses} meses más{ren.nota ? ` · «${ren.nota}»` : ''}.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <span className={ren.aceptaDueno ? 'font-bold text-andino' : 'text-suave'}>Dueño: {ren.aceptaDueno ? 'aceptó' : 'pendiente'}</span>
            <span className={ren.aceptaInquilino ? 'font-bold text-andino' : 'text-suave'}>Inquilino: {ren.aceptaInquilino ? 'aceptó' : 'pendiente'}</span>
          </div>
          {faltaMiRespuesta && (
            <button className="btn btn-primario" disabled={ocupado} onClick={() => correr(() => api.post(`/contratos/${c.id}/renovacion/aceptar`, { rol }), 'Aceptaste la renovación.')}>
              Aceptar renovación
            </button>
          )}
          {!faltaMiRespuesta && rol && <p className="text-xs text-suave">Esperando la respuesta de la otra parte.</p>}
        </div>
      )}
    </Bloque>
  );
}

/** Salida anticipada (función `salida_anticipada`): aplica la penalidad pactada y abre el check-out. */
export function SalidaAnticipada({ c, rol, alCambiar }: PropsAccion) {
  const reglas = useReglas();
  const { error, aviso, ocupado, correr } = useAccion(alCambiar);
  const plantilla = c.inmueble.plantillaReglas ?? 'MODERADA';
  const pct = reglas?.penalidadSalidaPct[plantilla];

  return (
    <Bloque
      icono="salida"
      titulo="Salir antes de tiempo"
      descripcion={
        rol === 'DUENO'
          ? 'Si recuperas el inmueble antes del vencimiento, se abre el check-out y se aplica la compensación pactada en las reglas.'
          : 'Si te vas antes del vencimiento, se aplica la penalidad pactada y se abre el check-out.'
      }
    >
      <NotaTestnet />
      <Resultado error={error} aviso={aviso} />
      {pct !== undefined && rol !== 'DUENO' && (
        <p className="rounded-md bg-crema p-3 text-sm">
          Penalidad de este inmueble (plantilla {plantilla.toLowerCase()}): <b>{pct} % del monto</b>
          {pct > 0 ? ` = ${usdc((c.montoUsdc * pct) / 100)}, descontados de la garantía.` : ': sin penalidad.'}
        </p>
      )}
      {c.estado !== 'ACTIVO' && <p className="text-sm text-suave">Solo se puede salir de forma anticipada de un contrato activo.</p>}
      {c.estado === 'ACTIVO' && !rol && <p className="text-sm text-suave">Solo las partes del contrato pueden pedirlo.</p>}
      {c.estado === 'ACTIVO' && rol && (
        <button
          className="btn btn-sec"
          disabled={ocupado}
          onClick={() => correr(() => api.post(`/contratos/${c.id}/salida-anticipada`, { solicitadaPor: rol }), 'Salida anticipada registrada: se abrió el check-out.')}
        >
          {rol === 'INQUILINO' ? 'Quiero salir antes' : 'Recuperar el inmueble antes'}
        </button>
      )}
    </Bloque>
  );
}

/** Disputa (función `abrir_disputa`) y su resolución por el mediador. */
export function Disputa({ c, rol, alCambiar }: PropsAccion) {
  const { error, aviso, ocupado, correr } = useAccion(alCambiar);
  const [motivo, setMotivo] = useState('');
  const [descuento, setDescuento] = useState('0');
  const [nota, setNota] = useState('');
  const enDisputa = c.estado === 'EN_DISPUTA';

  return (
    <Bloque
      icono="balanza"
      titulo={enDisputa ? 'Contrato en disputa' : 'Abrir una disputa'}
      descripcion={
        enDisputa
          ? 'Las reglas pactadas no resolvieron el desacuerdo: lo revisa un mediador de la plataforma (propuesto). Mientras tanto, el dinero sigue retenido.'
          : 'Si no hay acuerdo y las reglas pactadas no alcanzan, cualquiera de las partes puede abrir una disputa.'
      }
      tono={enDisputa ? 'alerta' : 'normal'}
    >
      <NotaTestnet />
      <Resultado error={error} aviso={aviso} />

      {enDisputa && (
        <>
          <p className="text-sm"><b>Motivo:</b> {c.disputaMotivo}</p>
          <div className="flex flex-wrap items-end gap-3 border-t-2 border-dashed border-borde pt-4">
            <div>
              <label className="label">Descuento de la garantía (USDC)</label>
              <input className="input !w-40" type="number" min={0} max={c.garantiaUsdc} value={descuento} onChange={(e) => setDescuento(e.target.value)} />
            </div>
            <div className="min-w-48 flex-1">
              <label className="label">Nota del mediador</label>
              <input className="input" value={nota} onChange={(e) => setNota(e.target.value)} />
            </div>
            <button
              className="btn btn-oscuro"
              disabled={ocupado}
              onClick={() => correr(() => api.post(`/contratos/${c.id}/disputa/resolver`, { descuentoUsdc: Number(descuento), nota: nota || undefined }), 'Disputa resuelta: el contrato vuelve al check-out.')}
            >
              Resolver como mediador
            </button>
          </div>
        </>
      )}

      {!enDisputa && (c.estado === 'ACTIVO' || c.estado === 'EN_CHECKOUT') && rol && (
        <div className="flex flex-wrap gap-2">
          <input className="input min-w-48 flex-1" placeholder="Cuenta brevemente el motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <button
            className="btn btn-peligro shrink-0"
            disabled={ocupado || !motivo.trim()}
            onClick={() => correr(() => api.post(`/contratos/${c.id}/disputa`, { motivo }), 'Disputa abierta.')}
          >
            Abrir disputa
          </button>
        </div>
      )}
      {!enDisputa && (c.estado === 'ACTIVO' || c.estado === 'EN_CHECKOUT') && !rol && (
        <p className="text-sm text-suave">Solo las partes del contrato pueden abrir una disputa.</p>
      )}
      {c.estado === 'FINALIZADO' && <p className="text-sm text-suave">El contrato ya finalizó.</p>}
    </Bloque>
  );
}

export const PASOS_DDRR = [
  'Lleva el contrato firmado a un notario, que lo protocoliza.',
  'Presenta la minuta protocolizada en Derechos Reales de tu ciudad.',
  'Paga las tasas de registro y espera la inscripción.',
  'Solicita un Folio Real actualizado donde figure el anticrético inscrito.',
  'Súbelo aquí: ganas la insignia «Inscrito en DD.RR.» y más reputación para ambas partes.',
];

/** Guía opcional para inscribir el anticrético en Derechos Reales (M12). Utama no hace el trámite. */
export function GuiaDdrr({ c, alCambiar }: { c: Contrato; alCambiar: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function subir(archivo?: File) {
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      const url = await api.subirFoto(archivo);
      await api.post(`/contratos/${c.id}/ddrr`, { url });
      alCambiar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <Bloque
      icono="documento"
      titulo="Inscripción en Derechos Reales (opcional)"
      descripcion="Utama no inscribe por ti, pero lo recomienda: cierra el hueco de un doble anticrético hecho por fuera de la plataforma."
    >
      <ol className="space-y-2 text-sm">
        {PASOS_DDRR.map((p, n) => (
          <li key={p} className="flex gap-2.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-sm bg-cochinilla text-xs font-bold text-lana">{n + 1}</span>
            <span>{p}</span>
          </li>
        ))}
      </ol>
      {c.ddrrUrl ? (
        <p className="flex items-center gap-2 text-sm font-bold text-andino"><Chakana className="h-4 w-4" /> Folio actualizado cargado: insignia «Inscrito en DD.RR.» otorgada.</p>
      ) : (
        <div>
          <label className="label">Folio actualizado (PDF o foto)</label>
          <input type="file" accept="image/*,application/pdf" disabled={subiendo || c.estado === 'FINALIZADO'} onChange={(e) => subir(e.target.files?.[0])} />
        </div>
      )}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </Bloque>
  );
}

/** Calificación mutua al finalizar el contrato (paso 14 del flujo). */
export function Calificar({ c, usuario, alCambiar }: { c: Contrato; usuario: Usuario | null; alCambiar: () => void }) {
  const [estrellas, setEstrellas] = useState(5);
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (c.estado !== 'FINALIZADO' || !usuario) return null;
  const participa = usuario.id === c.duenoId || usuario.id === c.inquilinoId;
  if (!participa) return null;
  const miCalificacion = c.calificaciones?.find((x) => x.deId === usuario.id);
  const otro = usuario.id === c.duenoId ? c.inquilino.nombre : c.dueno.nombre;

  async function enviar() {
    try {
      await api.post(`/contratos/${c.id}/calificaciones`, { deId: usuario!.id, estrellas, comentario: comentario || undefined });
      setError(null);
      alCambiar();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  return (
    <section className="card space-y-3">
      <h3 className="flex items-center gap-2.5 text-lg font-bold">
        <Chakana className="h-5 w-5 shrink-0 text-terracota" /> Califica a {otro}
      </h3>
      {miCalificacion ? (
        <div className="space-y-1">
          <Estrellas valor={miCalificacion.estrellas} />
          <p className="text-sm text-suave">Ya calificaste este contrato. Gracias: tu reseña construye la reputación de {otro}.</p>
        </div>
      ) : (
        <>
          <Estrellas valor={estrellas} onElegir={setEstrellas} />
          <input className="input" placeholder="Comentario (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} />
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <button className="btn btn-primario" onClick={enviar}>Enviar calificación</button>
        </>
      )}
      <p className="text-xs text-suave">Las calificaciones, los contratos cumplidos y el historial de ahorro en Vaquita definen el nivel de cada usuario.</p>
    </section>
  );
}
