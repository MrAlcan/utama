import { Chakana, Estrella8, Rombo, Titulo } from '@/components/Motivos';

const ETAPAS = [
  {
    etapa: '1',
    nombre: 'Anticrético seguro',
    estado: 'En el MVP',
    donde: 'Bolivia',
    texto: 'Verificación del folio, escrow en USDC, bloqueo del doble anticrético, check-in y check-out.',
    listo: true,
  },
  {
    etapa: '2',
    nombre: 'Marketplace',
    estado: 'En el MVP',
    donde: 'Bolivia',
    texto: 'Inmuebles verificados, reputación de dueños e inquilinos, calendario de visitas y reglas recomendadas.',
    listo: true,
  },
  {
    etapa: '→',
    nombre: 'Próxima entrega',
    estado: 'En desarrollo',
    donde: 'Bolivia',
    texto: 'Firma de cada usuario con Pollar, plan de devolución del dueño en Vaquita, verificador real (abogado aliado), consulta pública de folios on-chain, mainnet y piloto en Santa Cruz.',
    listo: false,
  },
  {
    etapa: '3',
    nombre: 'Expansión de inmuebles',
    estado: 'Próximamente',
    donde: 'Bolivia',
    texto: 'Locales, oficinas, pisos, galpones y habitaciones; alquiler con garantía y contratos mixtos.',
    listo: false,
  },
  {
    etapa: '4',
    nombre: 'Crédito e inversión',
    estado: 'Próximamente',
    donde: 'Bolivia',
    texto: 'Utama Crédito y Utama Invierte, con entidades reguladas aliadas, Blend y el historial de ahorro de Vaquita.',
    listo: false,
  },
  {
    etapa: '5',
    nombre: 'Internacional',
    estado: 'Próximamente',
    donde: 'Latinoamérica y España',
    texto: 'Pasaporte de inquilino portable y escrow de garantías para bolivianos que se mudan y para la diáspora.',
    listo: false,
  },
];

const MODULOS = [
  { t: 'Utama Crédito', d: 'Préstamo puente para que el dueño devuelva el anticrético, y financiamiento para completar el monto. Lo otorgan cooperativas y entidades reguladas aliadas; Utama aporta el scoring y la verificación.' },
  { t: 'Utama Invierte', d: 'Cooperativas y, más adelante, un pool de liquidez en USDC. La diáspora boliviana podrá invertir en vivienda en Bolivia desde el exterior.' },
  { t: 'Agentes inmobiliarios', d: 'Agentes verificados publican inmuebles de sus clientes y cobran su comisión desde el contrato inteligente al cerrar el trato.' },
  { t: 'Agentes verificadores', d: 'Visitas, check-in y check-out presenciales, con la insignia «Inmueble visitado».' },
  { t: 'Rendimiento con Blend', d: 'El fondo de garantía y el plan de devolución pueden generar intereses, repartidos según las reglas pactadas.' },
  { t: 'Administración', d: 'Cola de verificación manual, reglas recomendadas, mediación de disputas y métricas de la plataforma.' },
];

export default function HojaDeRuta() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Titulo nivel={1}>Hoja de ruta</Titulo>
        <p className="max-w-2xl text-suave">Bolivia es el mercado de entrada, no el límite. Esto es lo que ya funciona y lo que viene.</p>
      </div>

      <ol className="grid gap-4 md:grid-cols-5">
        {ETAPAS.map((e) => (
          <li key={e.etapa} className={`card space-y-2 ${e.listo ? 'border-andino' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="font-display text-3xl font-bold text-terracota">{e.etapa}</span>
              {e.listo ? <Estrella8 className="h-5 w-5 text-andino" /> : <Chakana className="h-5 w-5 text-borde" />}
            </div>
            <h2 className="text-lg font-bold">{e.nombre}</h2>
            <p className={`text-xs font-bold ${e.listo ? 'text-andino' : 'text-oro-texto'}`}>{e.estado} · {e.donde}</p>
            <p className="text-sm text-suave">{e.texto}</p>
          </li>
        ))}
      </ol>

      <div className="space-y-4">
        <Titulo>Lo que viene</Titulo>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((m) => (
            <div key={m.t} className="card space-y-2">
              <h3 className="flex items-center gap-2 text-lg font-bold"><Rombo className="h-4 w-4 text-terracota" /> {m.t}</h3>
              <p className="text-sm text-suave">{m.d}</p>
              <span className="inline-block rounded-sm bg-oro-claro px-2 py-0.5 text-xs font-bold text-oro-texto">Próximamente</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
