'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Usuario } from './types';

interface Ctx {
  usuario: Usuario | null;
  usuarios: Usuario[];
  cargando: boolean;
  seleccionar: (id: string) => void;
  recargar: () => Promise<void>;
}

const UsuarioContext = createContext<Ctx>({
  usuario: null,
  usuarios: [],
  cargando: true,
  seleccionar: () => {},
  recargar: async () => {},
});

const CLAVE = 'utama:usuario';

/**
 * Sesión de demostración: se elige un usuario de ejemplo en la barra superior.
 * Cuando se integre Pollar, aquí se reemplaza por el usuario que inicia sesión con su wallet.
 */
export function UsuarioProvider({ children }: { children: ReactNode }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [id, setId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    try {
      const lista = await api.get<Usuario[]>('/usuarios');
      setUsuarios(lista);
      let guardado: string | null = null;
      try {
        guardado = localStorage.getItem(CLAVE);
      } catch {}
      setId((actual) => {
        const elegido = actual ?? guardado;
        if (elegido && lista.some((u) => u.id === elegido)) return elegido;
        return (lista.find((u) => u.rol === 'INQUILINO') ?? lista[0])?.id ?? null;
      });
    } catch {
      setUsuarios([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recargar();
  }, [recargar]);

  const seleccionar = useCallback((nuevo: string) => {
    setId(nuevo);
    try {
      localStorage.setItem(CLAVE, nuevo);
    } catch {}
  }, []);

  const valor = useMemo<Ctx>(
    () => ({ usuario: usuarios.find((u) => u.id === id) ?? null, usuarios, cargando, seleccionar, recargar }),
    [usuarios, id, cargando, seleccionar, recargar],
  );

  return <UsuarioContext.Provider value={valor}>{children}</UsuarioContext.Provider>;
}

export const useUsuario = () => useContext(UsuarioContext);
