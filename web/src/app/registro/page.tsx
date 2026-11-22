'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icono } from '@/components/Iconos';
import { Titulo } from '@/components/Motivos';
import { Selector } from '@/components/Selector';
import { Mensaje } from '@/components/ui';
import { api, mensajeError } from '@/lib/api';
import type { Usuario } from '@/lib/types';
import { useUsuario } from '@/lib/usuario';

const PAISES: [string, string][] = [
  ['BO', 'Bolivia'],
  ['ES', 'España'],
  ['AR', 'Argentina'],
  ['BR', 'Brasil'],
  ['CL', 'Chile'],
  ['PE', 'Perú'],
  ['US', 'Estados Unidos'],
  ['OT', 'Otro país'],
];

/** Registro (M1): cuenta, país de residencia (define la moneda sugerida) y verificación de identidad simulada. */
export default function Registro() {
  const { usuario, recargar, seleccionar } = useUsuario();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<'INQUILINO' | 'DUENO' | 'AMBOS'>('AMBOS');
  const [pais, setPais] = useState('BO');
  const [creado, setCreado] = useState<Usuario | null>(null);
  const [ci, setCi] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [listo, setListo] = useState(false);

  // Si el usuario actual todavía no verificó su identidad, se le ofrece completarla.
  const porVerificar = creado ?? (usuario && !usuario.identidadVerificada ? usuario : null);

  async function crear() {
    setOcupado(true);
    setError(null);
    try {
      const u = await api.post<Usuario>('/usuarios', { nombre, email: email || undefined, rol, paisResidencia: pais });
      setCreado(u);
      await recargar();
      seleccionar(u.id);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function subir(archivo: File | undefined, poner: (u: string) => void) {
    if (!archivo) return;
    try {
      poner(await api.subirFoto(archivo));
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  async function verificar() {
    if (!porVerificar || !ci || !selfie) return;
    setOcupado(true);
    setError(null);
    try {
      await api.post(`/usuarios/${porVerificar.id}/verificar-identidad`, { ciDocUrl: ci, selfieUrl: selfie });
      await recargar();
      setListo(true);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }

  if (listo) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Mensaje tipo="ok">
          <Icono nombre="check" className="mr-1.5 inline h-4 w-4 align-text-bottom" /> Identidad verificada. Empiezas como «Nuevo verificado»: ya puedes tomar un anticrético o publicar tu inmueble.
        </Mensaje>
        <div className="flex gap-3">
          <Link href="/" className="btn btn-primario">Ver inmuebles</Link>
          <Link href="/publicar" className="btn btn-sec">Publicar un inmueble</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Titulo nivel={1}>{porVerificar ? 'Verifica tu identidad' : 'Crea tu cuenta'}</Titulo>
        <p className="mt-1 text-suave">Sin identidad verificada no se puede publicar ni tomar un anticrético.</p>
      </div>

      {!porVerificar && (
        <section className="card space-y-4">
          <div>
            <label className="label">Nombre completo</label>
            <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <label className="label">Correo electrónico</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <p className="label">¿Qué quieres hacer?</p>
            <div className="flex flex-wrap gap-2">
              {([['INQUILINO', 'Tomar un inmueble'], ['DUENO', 'Ofrecer un inmueble'], ['AMBOS', 'Ambos']] as const).map(([v, t]) => (
                <button key={v} type="button" className={`chip ${rol === v ? 'chip-activo' : ''}`} onClick={() => setRol(v)}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">País de residencia</label>
            <Selector valor={pais} onCambio={setPais} opciones={PAISES.map(([c, n]) => ({ valor: c, etiqueta: n }))} />
            <p className="mt-1 text-xs text-suave">
              Moneda sugerida: {pais === 'BO' ? 'bolivianos' : 'dólares digitales (USDC)'}. Podrás cambiarla al pagar.
            </p>
          </div>
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <button className="btn btn-primario w-full" onClick={crear} disabled={!nombre.trim() || ocupado}>
            Crear cuenta
          </button>
        </section>
      )}

      {porVerificar && (
        <section className="card space-y-4">
          <p className="text-sm">Cuenta: <b>{porVerificar.nombre}</b></p>
          <div>
            <label className="label">Foto de tu CI o pasaporte</label>
            <input type="file" accept="image/*" capture="environment" onChange={(e) => subir(e.target.files?.[0], setCi)} className="text-sm" />
            {ci && <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-andino"><Icono nombre="check" className="h-3.5 w-3.5" /> Documento cargado</p>}
          </div>
          <div>
            <label className="label">Selfie</label>
            <input type="file" accept="image/*" capture="user" onChange={(e) => subir(e.target.files?.[0], setSelfie)} className="text-sm" />
            {selfie && <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-andino"><Icono nombre="check" className="h-3.5 w-3.5" /> Selfie cargada</p>}
          </div>
          <p className="text-xs font-bold text-oro-texto">
            Verificación simulada: en producción pasa por IA y revisión humana, y los documentos se guardarían cifrados fuera de la cadena (en la demo se guardan sin cifrar).
          </p>
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <button className="btn btn-primario w-full" onClick={verificar} disabled={!ci || !selfie || ocupado}>
            Verificar identidad
          </button>
        </section>
      )}
    </div>
  );
}
