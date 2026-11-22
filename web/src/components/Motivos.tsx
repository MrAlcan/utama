import type { ReactNode } from 'react';

/** Motivos del área andina: chakana (cruz escalonada), estrella de 8 puntas y rombo de tejido. */

const CHAKANA_PTS: [number, number][] = [
  [40, 0], [60, 0], [60, 12], [72, 12], [72, 28], [88, 28], [88, 40], [100, 40], [100, 60], [88, 60],
  [88, 72], [72, 72], [72, 88], [60, 88], [60, 100], [40, 100], [40, 88], [28, 88], [28, 72], [12, 72],
  [12, 60], [0, 60], [0, 40], [12, 40], [12, 28], [28, 28], [28, 12], [40, 12],
];
const CHAKANA_D = `M${CHAKANA_PTS.map(([x, y]) => `${x} ${y}`).join(' L')} Z M59 50 A9 9 0 1 0 41 50 A9 9 0 1 0 59 50 Z`;

function estrellaD(R: number, ratio = 0.42): string {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const ang = ((-90 + i * 22.5) * Math.PI) / 180;
    const rad = i % 2 === 0 ? R : R * ratio;
    pts.push(`${(50 + rad * Math.cos(ang)).toFixed(2)} ${(50 + rad * Math.sin(ang)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}
const ESTRELLA_D = estrellaD(48);

export function Chakana({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden="true">
      <path d={CHAKANA_D} fillRule="evenodd" />
    </svg>
  );
}

export function Estrella8({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden="true">
      <path d={ESTRELLA_D} />
    </svg>
  );
}

export function Rombo({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden="true">
      <path d="M50 4 L96 50 L50 96 L4 50 Z M50 30 L30 50 L50 70 L70 50 Z" fillRule="evenodd" />
    </svg>
  );
}

export function Ubicacion({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden="true">
      <path d="M50 4 L82 36 L82 52 L50 96 L18 52 L18 36 Z M50 30 L36 44 L50 58 L64 44 Z" fillRule="evenodd" />
    </svg>
  );
}

/** Título de sección con una chakana y un filo de andenes debajo. */
export function Titulo({ children, nivel = 2, className = '' }: { children: ReactNode; nivel?: 1 | 2 | 3; className?: string }) {
  const tam = nivel === 1 ? 'text-3xl' : nivel === 2 ? 'text-2xl' : 'text-lg';
  return (
    <div className={className}>
      <h2 className={`flex items-center gap-2.5 font-bold ${tam}`}>
        <Chakana className={`${nivel === 3 ? 'h-4 w-4' : 'h-5 w-5'} shrink-0 text-terracota`} />
        {children}
      </h2>
    </div>
  );
}

