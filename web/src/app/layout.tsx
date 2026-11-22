import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import '@fontsource-variable/bitter';
import '@fontsource-variable/inter';
import { Header } from '@/components/Header';
import { Chakana } from '@/components/Motivos';
import { Proveedores } from '@/components/Proveedores';
import { UsuarioProvider } from '@/lib/usuario';
import './globals.css';

export const metadata: Metadata = {
  title: 'Utama — tu casa, sin preocupaciones',
  description: 'Anticréticos verificados y con el dinero protegido por un contrato inteligente en Stellar.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/** Fija el tema antes de pintar para evitar el parpadeo. Acepta ?tema=oscuro|claro; si no, usa lo guardado o la preferencia del sistema. */
const SCRIPT_TEMA = `(function(){try{var q=new URLSearchParams(location.search).get('tema');var t=(q==='oscuro'||q==='dark')?'dark':(q==='claro'||q==='light')?'light':localStorage.getItem('utama:tema');if(t!=='dark'&&t!=='light'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <Proveedores>
          <UsuarioProvider>
            <Header />
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>
            <footer className="mt-10 border-t-2 border-borde bg-barra text-tinta">
              <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/logo-sobre-claro.svg" alt="Utama" className="h-12 w-auto dark:hidden" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/logo-claro.svg" alt="Utama" className="hidden h-12 w-auto dark:block" />
                <p className="flex max-w-xl items-start justify-center gap-2 text-sm text-suave">
                  <Chakana className="mt-0.5 h-4 w-4 shrink-0 text-terracota" />
                  Utama usa la blockchain como un kipu moderno: un registro de confianza que nadie puede borrar.
                </p>
                <p className="text-xs text-suave">Utama significa «tu casa» en aymara · Stellar Bolivia 2026</p>
                <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm font-semibold text-terracota">
                  <Link href="/hoja-de-ruta" className="hover:underline">Hoja de ruta</Link>
                  <Link href="/registro" className="hover:underline">Crear cuenta</Link>
                  <Link href="/publicar" className="hover:underline">Publicar un inmueble</Link>
                </nav>
              </div>
            </footer>
          </UsuarioProvider>
        </Proveedores>
      </body>
    </html>
  );
}
