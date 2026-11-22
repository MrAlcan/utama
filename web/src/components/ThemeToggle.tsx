'use client';

import { useEffect, useState } from 'react';

type Tema = 'light' | 'dark';

/** Alterna entre el tema claro y el oscuro. La elección se guarda en el navegador. */
export function ThemeToggle() {
  const [tema, setTema] = useState<Tema>('light');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTema(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  function cambiar() {
    const nuevo: Tema = tema === 'dark' ? 'light' : 'dark';
    setTema(nuevo);
    document.documentElement.dataset.theme = nuevo;
    try {
      localStorage.setItem('utama:tema', nuevo);
    } catch {}
  }

  const oscuro = tema === 'dark';
  return (
    <button
      type="button"
      onClick={cambiar}
      aria-label={oscuro ? 'Cambiar al tema claro' : 'Cambiar al tema oscuro'}
      title={oscuro ? 'Tema claro' : 'Tema oscuro'}
      className="grid h-10 w-10 place-items-center rounded-md border-2 border-borde text-tinta transition hover:bg-oro-claro"
    >
      {oscuro ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path d="M21 14.5A9 9 0 0 1 9.5 3 9 9 0 1 0 21 14.5Z" />
        </svg>
      )}
    </button>
  );
}
