export type Plantilla = 'FLEXIBLE' | 'MODERADA' | 'ESTRICTA';

/** Penalidad por salida anticipada del inquilino, como % del monto del anticrético. */
export const PENALIDAD_SALIDA_PCT: Record<Plantilla, number> = { FLEXIBLE: 0, MODERADA: 3, ESTRICTA: 6 };

/** Fondo de garantía recomendado por plantilla (D3: 10 a 20 %). */
export const GARANTIA_RECOMENDADA_PCT: Record<Plantilla, number> = { FLEXIBLE: 10, MODERADA: 15, ESTRICTA: 20 };

export interface CategoriaRegla {
  clave: string;
  titulo: string;
  FLEXIBLE: string;
  MODERADA: string;
  ESTRICTA: string;
}

/** Categorías de reglas del módulo M4, con las plantillas Flexible / Moderada / Estricta. */
export const REGLAS: CategoriaRegla[] = [
  {
    clave: 'salida_anticipada',
    titulo: 'Salida anticipada del inquilino',
    FLEXIBLE: 'Preaviso de 30 días. Sin penalidad.',
    MODERADA: 'Preaviso de 60 días. Penalidad del 3 % del monto, descontada de la garantía.',
    ESTRICTA: 'Preaviso de 90 días. Penalidad del 6 % del monto, descontada de la garantía.',
  },
  {
    clave: 'recuperacion',
    titulo: 'Recuperación anticipada por el dueño',
    FLEXIBLE: 'Preaviso de 60 días y devolución total en 30 días.',
    MODERADA: 'Preaviso de 90 días, devolución total y compensación de 1 mes de uso.',
    ESTRICTA: 'Preaviso de 120 días, devolución total y compensación de 3 meses de uso.',
  },
  {
    clave: 'danos',
    titulo: 'Daños y descuentos',
    FLEXIBLE: 'Solo daños mayores al desgaste normal, valorados de común acuerdo.',
    MODERADA: 'Daños frente al inventario inicial, valorados con 2 cotizaciones.',
    ESTRICTA: 'Cualquier daño frente al inventario inicial, valorado con la cotización de un profesional.',
  },
  {
    clave: 'renovacion',
    titulo: 'Renovación',
    FLEXIBLE: 'Se renueva si ninguna parte avisa lo contrario con 30 días de anticipación.',
    MODERADA: 'Se renueva si ambas partes aceptan las nuevas condiciones, negociadas en la plataforma.',
    ESTRICTA: 'Solo con acuerdo escrito de ambas partes, 90 días antes del vencimiento.',
  },
  {
    clave: 'garantia',
    titulo: 'Fondo de garantía',
    FLEXIBLE: '10 % del monto, bloqueado hasta el check-out.',
    MODERADA: '15 % del monto, bloqueado hasta el check-out.',
    ESTRICTA: '20 % del monto, bloqueado hasta el check-out.',
  },
  {
    clave: 'plan_devolucion',
    titulo: 'Plan de devolución',
    FLEXIBLE: 'Aporte mensual sugerido; el dueño puede ajustarlo.',
    MODERADA: 'Aporte mensual mínimo del 2 % del monto, con alertas de atraso.',
    ESTRICTA: 'Aporte mensual mínimo del 3 %, con alertas y baja de reputación ante atrasos.',
  },
  {
    clave: 'convivencia',
    titulo: 'Convivencia',
    FLEXIBLE: 'Mascotas y visitas permitidas. Ruido razonable.',
    MODERADA: 'Mascotas con aviso previo. Ruido permitido hasta las 22:00.',
    ESTRICTA: 'Sin mascotas, visitas limitadas y silencio desde las 21:00.',
  },
  {
    clave: 'servicios',
    titulo: 'Servicios y expensas',
    FLEXIBLE: 'El dueño paga las expensas; el inquilino, los servicios de consumo.',
    MODERADA: 'El inquilino paga servicios y expensas ordinarias.',
    ESTRICTA: 'El inquilino paga todo; el dueño solo las reparaciones estructurales.',
  },
  {
    clave: 'negocios',
    titulo: 'Negocios (locales, oficinas y galpones)',
    FLEXIBLE: 'Remodelaciones menores con aviso. Subalquiler con acuerdo.',
    MODERADA: 'Mejoras con autorización escrita, rubro y horarios pactados. Sin subalquiler.',
    ESTRICTA: 'Sin remodelaciones sin autorización, rubro único y sin subalquiler.',
  },
];
