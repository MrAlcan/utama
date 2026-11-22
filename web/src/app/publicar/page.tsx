'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Icono, IconoTipo } from '@/components/Iconos';
import { Mapa, type Coordenada } from '@/components/Mapa';
import { Titulo } from '@/components/Motivos';
import { useReglas } from '@/components/ReglasInmueble';
import { Selector } from '@/components/Selector';
import { Mensaje } from '@/components/ui';
import { api, mensajeError } from '@/lib/api';
import type { Inmueble, ResultadoFolio } from '@/lib/types';
import { useUsuario } from '@/lib/usuario';

/** Centros de las ciudades principales, para que el mapa abra cerca. */
const CENTROS: Record<string, Coordenada> = {
  'santa cruz': { lat: -17.7833, lng: -63.1821 },
  cochabamba: { lat: -17.3895, lng: -66.1568 },
  'la paz': { lat: -16.4897, lng: -68.1193 },
  'el alto': { lat: -16.5, lng: -68.1633 },
  sucre: { lat: -19.0196, lng: -65.2619 },
  tarija: { lat: -21.5355, lng: -64.7296 },
  oruro: { lat: -17.9647, lng: -67.1061 },
  potosí: { lat: -19.5836, lng: -65.7531 },
};

/** Convierte "−17,76" o "-17.76" en número; devuelve null si no es un número válido. */
function numero(t: string): number | null {
  const n = Number(t.trim().replace(',', '.'));
  return t.trim() !== '' && Number.isFinite(n) ? n : null;
}

interface Escenario {
  clave: string;
  etiqueta: string;
}

export default function Publicar() {
  const router = useRouter();
  const { usuario } = useUsuario();
  const reglas = useReglas();

  const [f, setF] = useState({
    titulo: '',
    descripcion: '',
    tipo: 'VIVIENDA',
    tipoContrato: 'ANTICRETICO',
    ciudad: 'Santa Cruz',
    zona: '',
    direccion: '',
    latitud: '',
    longitud: '',
    superficieM2: '80',
    dormitorios: '2',
    banos: '1',
    amoblado: false,
    montoUsdc: '30000',
    plazoMeses: '24',
    garantiaPct: '15',
    plantillaReglas: 'MODERADA',
    reglasRecomendadas: true,
    folioNumero: '',
    escenarioFolio: 'LIMPIO',
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  const [escenarios, setEscenarios] = useState<Escenario[]>([]);
  const [folio, setFolio] = useState<ResultadoFolio | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [fotos, setFotos] = useState<string[]>([]);
  const [folioDoc, setFolioDoc] = useState<string | null>(null);
  const [ciDoc, setCiDoc] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);

  useEffect(() => {
    api.get<Escenario[]>('/folio/escenarios').then(setEscenarios).catch(() => {});
  }, []);

  const lat = numero(f.latitud);
  const lng = numero(f.longitud);
  const coordsValidas = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const fueraDeBolivia = coordsValidas && (lat < -22.95 || lat > -9.6 || lng < -69.7 || lng > -57.4);
  const elegida = useMemo<Coordenada | null>(() => (coordsValidas ? { lat: lat as number, lng: lng as number } : null), [coordsValidas, lat, lng]);
  const centro = CENTROS[f.ciudad.trim().toLowerCase()] ?? null;
  const [gps, setGps] = useState<string | null>(null);

  function fijarPosicion(c: Coordenada) {
    setF((x) => ({ ...x, latitud: c.lat.toFixed(6), longitud: c.lng.toFixed(6) }));
  }

  function usarMiUbicacion() {
    setGps(null);
    if (!navigator.geolocation) return setGps('Este navegador no permite obtener la ubicación. Haz clic en el mapa o escribe las coordenadas.');
    navigator.geolocation.getCurrentPosition(
      (p) => fijarPosicion({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGps('No se pudo obtener tu ubicación (revisa el permiso del navegador). Haz clic en el mapa o escribe las coordenadas.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function elegirPlantilla(p: 'FLEXIBLE' | 'MODERADA' | 'ESTRICTA') {
    set('plantillaReglas', p);
    // La plantilla sugiere el fondo de garantía (D3: entre 10 y 20 %).
    if (reglas) set('garantiaPct', String(reglas.garantiaRecomendadaPct[p]));
  }

  async function verificar() {
    setVerificando(true);
    setFolio(null);
    setError(null);
    try {
      setFolio(await api.post<ResultadoFolio>('/folio/verificar', { folioNumero: f.folioNumero, escenario: f.escenarioFolio }));
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setVerificando(false);
    }
  }

  async function subirFotos(archivos: FileList | null) {
    if (!archivos?.length) return;
    setSubiendo(true);
    try {
      const urls = await Promise.all([...archivos].map((a) => api.subirFoto(a)));
      setFotos((x) => [...x, ...urls]);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setSubiendo(false);
    }
  }

  async function subirUno(archivo: File | undefined, poner: (u: string) => void) {
    if (!archivo) return;
    setSubiendo(true);
    try {
      poner(await api.subirFoto(archivo));
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setSubiendo(false);
    }
  }

  async function publicar() {
    if (!usuario) return;
    setPublicando(true);
    setError(null);
    try {
      const creado = await api.post<Inmueble>('/inmuebles', {
        duenoId: usuario.id,
        titulo: f.titulo,
        descripcion: f.descripcion,
        tipo: f.tipo,
        tipoContrato: f.tipoContrato,
        ciudad: f.ciudad,
        zona: f.zona,
        direccion: f.direccion,
        latitud: lat,
        longitud: lng,
        superficieM2: Number(f.superficieM2),
        dormitorios: Number(f.dormitorios),
        banos: Number(f.banos),
        amoblado: f.amoblado,
        montoUsdc: Number(f.montoUsdc),
        plazoMeses: Number(f.plazoMeses),
        garantiaPct: Number(f.garantiaPct),
        plantillaReglas: f.plantillaReglas,
        reglasRecomendadas: f.reglasRecomendadas,
        folioNumero: f.folioNumero,
        escenarioFolio: f.escenarioFolio,
        folioDocUrl: folioDoc ?? undefined,
        ciDocUrl: ciDoc ?? undefined,
        fotos: fotos.length ? fotos : [`/ejemplos/inm-${{ VIVIENDA: 1, HABITACION: 2, LOCAL: 3, OFICINA: 4, GALPON: 5 }[f.tipo] ?? 2}-0.svg`],
      });
      router.push(`/inmuebles/${creado.id}`);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setPublicando(false);
    }
  }

  if (usuario?.rol === 'INQUILINO') {
    return <Mensaje tipo="info">Estás como inquilino. Cambia a un usuario dueño en la barra superior para publicar un inmueble.</Mensaje>;
  }
  if (usuario && !usuario.identidadVerificada) {
    return (
      <Mensaje tipo="info">
        Para publicar necesitas verificar tu identidad. <Link href="/registro" className="font-bold underline">Verificar ahora</Link>.
      </Mensaje>
    );
  }

  const listo = folio?.verificado && f.titulo && f.zona && f.direccion && f.descripcion && coordsValidas;
  const plantillaReglas = f.plantillaReglas as 'FLEXIBLE' | 'MODERADA' | 'ESTRICTA';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Titulo nivel={1}>Publicar un inmueble</Titulo>
        <p className="mt-1 text-suave">Para publicar necesitas el folio verificado, fotos, reglas y condiciones.</p>
      </div>

      <section className="card space-y-4">
        <Titulo nivel={3}>1. Datos del inmueble</Titulo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo t="Título" className="sm:col-span-2"><input className="input" value={f.titulo} onChange={(e) => set('titulo', e.target.value)} /></Campo>
          <Campo t="Tipo de inmueble">
            <Selector
              valor={f.tipo}
              onCambio={(v) => set('tipo', v)}
              opciones={[
                { valor: 'VIVIENDA', etiqueta: 'Casa / departamento', icono: <IconoTipo tipo="VIVIENDA" /> },
                { valor: 'LOCAL', etiqueta: 'Local comercial', icono: <IconoTipo tipo="LOCAL" /> },
                { valor: 'OFICINA', etiqueta: 'Oficina', icono: <IconoTipo tipo="OFICINA" /> },
                { valor: 'GALPON', etiqueta: 'Galpón / depósito', icono: <IconoTipo tipo="GALPON" /> },
                { valor: 'HABITACION', etiqueta: 'Habitación', icono: <IconoTipo tipo="HABITACION" /> },
              ]}
            />
          </Campo>
          <Campo t="Tipo de contrato">
            <Selector
              valor={f.tipoContrato}
              onCambio={(v) => set('tipoContrato', v)}
              opciones={[
                { valor: 'ANTICRETICO', etiqueta: 'Anticrético' },
              ]}
            />
          </Campo>
          <Campo t="Ciudad"><input className="input" value={f.ciudad} onChange={(e) => set('ciudad', e.target.value)} /></Campo>
          <Campo t="Zona o barrio"><input className="input" value={f.zona} onChange={(e) => set('zona', e.target.value)} /></Campo>
          <Campo t="Dirección exacta (privada)" className="sm:col-span-2"><input className="input" value={f.direccion} onChange={(e) => set('direccion', e.target.value)} /></Campo>
          <div className="space-y-3 sm:col-span-2">
            <div>
              <p className="label !mb-0 flex items-center gap-1.5"><Icono nombre="ubicacion" className="h-4 w-4 text-terracota" /> Ubicación en el mapa</p>
              <p className="text-xs text-suave">
                Haz clic en el mapa, arrastra el alfiler, usa tu ubicación o escribe la latitud y la longitud. Con estos datos el inmueble aparece en el mapa de Utama. El público verá solo una zona aproximada
                (unos 200 m a la redonda); la posición exacta la ven quienes agendan una visita o firman el contrato.
              </p>
            </div>
            <Mapa elegida={elegida} onElegir={fijarPosicion} centro={centro} alto="h-72" etiqueta="Mapa para ubicar el inmueble" />
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Campo t="Latitud"><input className="input" inputMode="decimal" placeholder="-17.783300" value={f.latitud} onChange={(e) => set('latitud', e.target.value)} /></Campo>
              <Campo t="Longitud"><input className="input" inputMode="decimal" placeholder="-63.182100" value={f.longitud} onChange={(e) => set('longitud', e.target.value)} /></Campo>
              <div className="flex items-end">
                <button type="button" className="btn btn-sec w-full sm:w-auto" onClick={usarMiUbicacion}>
                  <Icono nombre="gps" /> Usar mi ubicación
                </button>
              </div>
            </div>
            {(f.latitud || f.longitud) && !coordsValidas && (
              <p className="text-xs font-semibold text-peligro">Escribe números válidos: latitud entre −90 y 90, longitud entre −180 y 180.</p>
            )}
            {fueraDeBolivia && <p className="text-xs font-semibold text-oro-texto">Esa posición queda fuera de Bolivia. Revisa que la latitud y la longitud no estén al revés.</p>}
            {gps && <p className="text-xs text-suave">{gps}</p>}
          </div>
          <Campo t="Superficie (m²)"><input className="input" type="number" value={f.superficieM2} onChange={(e) => set('superficieM2', e.target.value)} /></Campo>
          <Campo t="Dormitorios"><input className="input" type="number" value={f.dormitorios} onChange={(e) => set('dormitorios', e.target.value)} /></Campo>
          <Campo t="Baños"><input className="input" type="number" value={f.banos} onChange={(e) => set('banos', e.target.value)} /></Campo>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold"><input type="checkbox" checked={f.amoblado} onChange={(e) => set('amoblado', e.target.checked)} /> Amoblado</label>
          <Campo t="Descripción" className="sm:col-span-2"><textarea className="input min-h-24" value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} /></Campo>
        </div>
      </section>

      <section className="card space-y-4">
        <Titulo nivel={3}>2. Condiciones y reglas</Titulo>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo t="Monto (USDC)"><input className="input" type="number" value={f.montoUsdc} onChange={(e) => set('montoUsdc', e.target.value)} /></Campo>
          <Campo t="Plazo (meses)">
            <Selector
              valor={f.plazoMeses}
              onCambio={(v) => set('plazoMeses', v)}
              opciones={[
                { valor: '12', etiqueta: '12 meses (1 año)' },
                { valor: '24', etiqueta: '24 meses (2 años)' },
                { valor: '36', etiqueta: '36 meses (3 años)' },
              ]}
            />
          </Campo>
          <Campo t={`Fondo de garantía: ${f.garantiaPct}%`}>
            <input className="w-full accent-cochinilla" type="range" min={10} max={20} value={f.garantiaPct} onChange={(e) => set('garantiaPct', e.target.value)} />
          </Campo>
        </div>
        <div>
          <p className="label">Plantilla de reglas</p>
          <div className="flex flex-wrap gap-2">
            {(['FLEXIBLE', 'MODERADA', 'ESTRICTA'] as const).map((p) => (
              <button key={p} type="button" className={`chip ${f.plantillaReglas === p ? 'chip-activo' : ''}`} onClick={() => elegirPlantilla(p)}>
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          {reglas && (
            <ul className="mt-3 space-y-1.5 rounded-md bg-crema p-3 text-xs">
              {reglas.categorias.map((c) => (
                <li key={c.clave}><b>{c.titulo}:</b> <span className="text-suave">{c[plantillaReglas]}</span></li>
              ))}
            </ul>
          )}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input className="mt-1" type="checkbox" checked={f.reglasRecomendadas} onChange={(e) => set('reglasRecomendadas', e.target.checked)} />
          <span>Aceptar las <b>reglas recomendadas</b> por Utama: ganas el sello «Reglas recomendadas» y más visibilidad en el marketplace.</span>
        </label>
      </section>

      <section className="card space-y-4">
        <Titulo nivel={3}>3. Documentos y Folio Real</Titulo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo t="Folio Real actualizado (PDF o foto)">
            <input type="file" accept="image/*,application/pdf" onChange={(e) => subirUno(e.target.files?.[0], setFolioDoc)} className="text-sm" />
            {folioDoc && <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-andino"><Icono nombre="check" className="h-3.5 w-3.5" /> Documento cargado</p>}
          </Campo>
          <Campo t="Documento de identidad del dueño">
            <input type="file" accept="image/*,application/pdf" onChange={(e) => subirUno(e.target.files?.[0], setCiDoc)} className="text-sm" />
            {ciDoc && <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-andino"><Icono nombre="check" className="h-3.5 w-3.5" /> Documento cargado</p>}
          </Campo>
          <Campo t="Número de folio"><input className="input" placeholder="7.01.1.99.0012345" value={f.folioNumero} onChange={(e) => set('folioNumero', e.target.value)} /></Campo>
          <Campo t="Folio de ejemplo (simulación)">
            <Selector valor={f.escenarioFolio} onCambio={(v) => set('escenarioFolio', v)} opciones={escenarios.map((e) => ({ valor: e.clave, etiqueta: e.etiqueta }))} placeholder="Cargando…" />
          </Campo>
        </div>
        <p className="text-xs text-suave">Los documentos se guardan fuera de la cadena (en la demo, sin cifrar); a la blockchain solo va el hash del folio.</p>
        <button className="btn btn-andino" onClick={verificar} disabled={verificando || f.folioNumero.length < 5}>
          {verificando ? 'Leyendo el documento…' : 'Verificar folio'}
        </button>
        {folio && (
          <div className={`space-y-1 rounded-md border-2 p-4 ${folio.verificado ? 'border-andino bg-andino-claro' : 'border-peligro bg-peligro-claro'}`}>
            <p className="flex items-center gap-2 font-bold"><Icono nombre={folio.verificado ? 'check' : 'prohibido'} className="h-4 w-4" /> {folio.verificado ? 'Folio verificado' : 'Folio rechazado'}</p>
            <p className="text-sm">{folio.motivo}</p>
            <p className="text-xs text-suave">Titular: {folio.titular} · Gravámenes: {folio.gravamenes.length ? folio.gravamenes.join('; ') : 'ninguno'}</p>
            <p className="break-all text-xs text-suave">Hash del folio (va al contrato): {folio.folioHash}</p>
            <p className="text-xs font-bold text-oro-texto">Verificación simulada: no se leyó ningún documento real.</p>
          </div>
        )}
      </section>

      <section className="card space-y-3">
        <Titulo nivel={3}>4. Fotos</Titulo>
        <p className="text-sm text-suave">Toma las fotos desde la cámara de la app: en el celular se abre la cámara directamente y queda registrada la fecha.</p>
        <input type="file" accept="image/*" capture="environment" multiple onChange={(e) => subirFotos(e.target.files)} className="text-sm" />
        {subiendo && <p className="text-sm text-suave">Subiendo…</p>}
        <div className="flex flex-wrap gap-2">
          {fotos.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt="" className="h-20 w-28 rounded-md border-2 border-borde object-cover" />
          ))}
        </div>
        {fotos.length === 0 && <p className="text-xs text-suave">Si no subes ninguna, se usará una imagen de ejemplo.</p>}
      </section>

      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <button className="btn btn-primario w-full" onClick={publicar} disabled={!listo || publicando}>
        {publicando ? 'Publicando…' : 'Publicar inmueble'}
      </button>
      {!listo && <p className="text-center text-xs text-suave">Completa los datos, ubica el inmueble en el mapa y verifica el folio para publicar.</p>}
    </div>
  );
}

function Campo({ t, children, className = '' }: { t: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label className="label">{t}</label>
      {children}
    </div>
  );
}
