'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type { Circle, DivIcon, Map as MapaLeaflet, Marker } from 'leaflet';

type Leaflet = typeof import('leaflet');

export interface PuntoMapa {
  id: string;
  lat: number;
  lng: number;
  /** Disponible (verde azulado) o en anticrético (dorado). */
  estado: 'PUBLICADO' | 'EN_ANTICRETICO';
  /** Si la posición es aproximada, se dibuja además un círculo de zona. */
  aproximado?: boolean;
  titulo?: string;
}

export interface Coordenada {
  lat: number;
  lng: number;
}

/** Santa Cruz de la Sierra: centro por defecto cuando todavía no hay ninguna posición. */
const CENTRO: Coordenada = { lat: -17.7833, lng: -63.1821 };

export const COLOR_PIN = { PUBLICADO: '#1B7F86', EN_ANTICRETICO: '#E3A72F', ELEGIDA: '#C84A28' } as const;

/** Alfiler con una chakana en el centro. */
function icono(L: Leaflet, color: string, seleccionado: boolean): DivIcon {
  const svg = `<svg width="32" height="42" viewBox="0 0 32 42" aria-hidden="true">
    <path d="M16 1C7.7 1 1 7.6 1 15.8 1 26.6 16 41 16 41s15-14.4 15-25.2C31 7.6 24.3 1 16 1z" fill="${color}" stroke="#2B1B17" stroke-width="2"/>
    <path d="M13 9h6v4h4v6h-4v4h-6v-4H9v-6h4z" fill="#FFF9EE"/>
  </svg>`;
  return L.divIcon({ html: svg, className: `pin-utama${seleccionado ? ' sel' : ''}`, iconSize: [32, 42], iconAnchor: [16, 41] });
}

interface Props {
  puntos?: PuntoMapa[];
  seleccionado?: string | null;
  onSeleccionar?: (id: string | null) => void;
  /** Modo "elegir ubicación": un clic en el mapa (o arrastrar el alfiler) fija esta posición. */
  elegida?: Coordenada | null;
  onElegir?: (c: Coordenada) => void;
  /** Alto del mapa (clases de Tailwind). */
  alto?: string;
  /** Acercamiento cuando hay un solo punto. */
  zoomUnico?: number;
  /** Dónde centrar el mapa mientras no hay inmuebles ni una posición elegida (por ejemplo, la ciudad). */
  centro?: Coordenada | null;
  etiqueta: string;
}

/** Mapa con OpenStreetMap. Muestra inmuebles como alfileres y, opcionalmente, deja elegir una posición. */
export function Mapa({ puntos = [], seleccionado = null, onSeleccionar, elegida = null, onElegir, alto = 'h-80', zoomUnico = 15, centro = null, etiqueta }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const lib = useRef<Leaflet | null>(null);
  const mapa = useRef<MapaLeaflet | null>(null);
  const capas = useRef<(Marker | Circle)[]>([]);
  const pinElegido = useRef<Marker | null>(null);
  const encuadrado = useRef(false);
  const alElegir = useRef(onElegir);
  const alSeleccionar = useRef(onSeleccionar);
  const [listo, setListo] = useState(false);
  const modoElegir = !!onElegir;

  useEffect(() => {
    alElegir.current = onElegir;
    alSeleccionar.current = onSeleccionar;
  });

  // Crea el mapa una sola vez (Leaflet necesita el navegador, por eso se carga aquí).
  useEffect(() => {
    let vivo = true;
    import('leaflet').then((mod) => {
      if (!vivo || !caja.current || mapa.current) return;
      const L = mod.default;
      lib.current = L;
      const m = L.map(caja.current, { center: [CENTRO.lat, CENTRO.lng], zoom: 12, scrollWheelZoom: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(m);
      m.on('click', (e) => {
        if (alElegir.current) alElegir.current({ lat: e.latlng.lat, lng: e.latlng.lng });
        else alSeleccionar.current?.(null);
      });
      // La rueda del ratón solo acerca cuando el mapa tiene el foco (si no, estorba al desplazar la página).
      m.on('focus', () => m.scrollWheelZoom.enable());
      m.on('blur', () => m.scrollWheelZoom.disable());
      mapa.current = m;
      setListo(true);
    });
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
      capas.current = [];
      pinElegido.current = null;
      encuadrado.current = false;
      setListo(false);
    };
  }, []);

  // Dibuja los inmuebles.
  useEffect(() => {
    const L = lib.current;
    const m = mapa.current;
    if (!listo || !L || !m) return;
    capas.current.forEach((c) => c.remove());
    capas.current = [];
    for (const p of puntos) {
      if (p.aproximado) {
        capas.current.push(
          L.circle([p.lat, p.lng], { radius: 260, color: COLOR_PIN[p.estado], weight: 1, fillColor: COLOR_PIN[p.estado], fillOpacity: 0.12, interactive: false }).addTo(m),
        );
      }
      const mk = L.marker([p.lat, p.lng], { icon: icono(L, COLOR_PIN[p.estado], p.id === seleccionado), title: p.titulo, keyboard: true, riseOnHover: true }).addTo(m);
      mk.on('click', () => alSeleccionar.current?.(p.id));
      capas.current.push(mk);
    }
    // Encuadra todos los puntos la primera vez que llegan.
    if (!encuadrado.current && puntos.length > 0 && !elegida) {
      encuadrado.current = true;
      if (puntos.length === 1) m.setView([puntos[0].lat, puntos[0].lng], zoomUnico);
      else m.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 14 });
    }
  }, [listo, puntos, seleccionado, elegida, zoomUnico]);

  // Centra el mapa en la ciudad mientras no haya nada más que mostrar.
  const cLat = centro?.lat;
  const cLng = centro?.lng;
  useEffect(() => {
    if (!listo || !mapa.current || cLat == null || cLng == null || elegida || puntos.length > 0) return;
    mapa.current.setView([cLat, cLng], 13);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, cLat, cLng]);

  // Alfiler de "elegir ubicación".
  useEffect(() => {
    const L = lib.current;
    const m = mapa.current;
    if (!listo || !L || !m || !modoElegir) return;
    if (!elegida) {
      pinElegido.current?.remove();
      pinElegido.current = null;
      return;
    }
    if (!pinElegido.current) {
      const pin = L.marker([elegida.lat, elegida.lng], { icon: icono(L, COLOR_PIN.ELEGIDA, false), draggable: true, keyboard: true }).addTo(m);
      pin.on('dragend', () => {
        const p = pin.getLatLng();
        alElegir.current?.({ lat: p.lat, lng: p.lng });
      });
      pinElegido.current = pin;
    } else {
      pinElegido.current.setLatLng([elegida.lat, elegida.lng]);
    }
    // Centra el mapa solo si el alfiler quedó fuera de la vista (por ejemplo, al escribir las coordenadas).
    if (!m.getBounds().contains([elegida.lat, elegida.lng])) m.setView([elegida.lat, elegida.lng], Math.max(m.getZoom(), 15));
  }, [listo, elegida, modoElegir]);

  return (
    <div
      ref={caja}
      role="application"
      aria-label={etiqueta}
      tabIndex={0}
      className={`mapa w-full overflow-hidden rounded-md border-2 border-borde ${alto} ${onElegir ? 'cursor-crosshair' : ''}`}
    />
  );
}
