'use client';

import { PollarProvider } from '@pollar/react';
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { esPollarHabilitado } from '@/lib/pollar-helpers';

const POLLAR_API_KEY = process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY?.trim() ?? '';
const PollarMontadoContext = createContext(false);

const suscribirVacio = () => () => {};
const esCliente = () => true;
const esServidor = () => false;

/** Indica si PollarProvider está montado en cliente y listo para usar usePollar(). */
export function usePollarMontado(): boolean {
  return useContext(PollarMontadoContext);
}

/**
 * Monta PollarProvider solo en cliente y cuando existe NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY.
 * Evita instanciar PollarClient en SSR durante next build y mantiene el plan B sin key.
 */
export function Proveedores({ children }: { children: ReactNode }) {
  const enCliente = useSyncExternalStore(suscribirVacio, esCliente, esServidor);

  if (!enCliente || !esPollarHabilitado(POLLAR_API_KEY)) {
    return <PollarMontadoContext.Provider value={false}>{children}</PollarMontadoContext.Provider>;
  }

  return (
    <PollarProvider
      client={{
        apiKey: POLLAR_API_KEY,
        stellarNetwork: 'testnet',
      }}
    >
      <PollarMontadoContext.Provider value={true}>{children}</PollarMontadoContext.Provider>
    </PollarProvider>
  );
}
