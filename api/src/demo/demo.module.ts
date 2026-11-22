import { Module } from '@nestjs/common';
import { SaldosModule } from '../stellar/saldos.module.js';
import { STELLAR_CONFIG } from '../stellar/stellar.module.js';
import { Enviador } from '../stellar/enviador.js';
import { KeypairFirmante } from '../stellar/firmante.js';
import { Saldos, recargarDemo } from '../stellar/saldos.js';
import type { Rol, StellarConfig } from '../stellar/stellar.config.js';
import { DemoController } from './demo.controller.js';
import { DemoService, RECARGA_DEMO, type RecargaDemo } from './demo.service.js';

/** Saldo objetivo de pantalla de las cuentas demo tras un reset (X-04). */
export const OBJETIVOS_DEMO: { rol: Rol; objetivoPantalla: number }[] = [
  { rol: 'MARIA', objetivoPantalla: 40_000 },
  { rol: 'DIEGO', objetivoPantalla: 40_000 },
  { rol: 'CARLOS', objetivoPantalla: 30_000 },
  { rol: 'LUCIA', objetivoPantalla: 30_000 },
];

@Module({
  imports: [SaldosModule],
  controllers: [DemoController],
  providers: [
    {
      provide: RECARGA_DEMO,
      inject: [STELLAR_CONFIG, Saldos, Enviador, KeypairFirmante],
      useFactory: (c: StellarConfig, saldos: Saldos, enviador: Enviador, f: KeypairFirmante): RecargaDemo =>
        async () => {
          if (!c.tesoro) throw new Error('No hay TESORO configurado');
          const objetivos = OBJETIVOS_DEMO.map((o) => ({ direccion: f.direccion(o.rol), objetivoPantalla: o.objetivoPantalla }));
          return recargarDemo(objetivos, { saldos, enviador, tesoro: c.tesoro, escala: c.escala });
        },
    },
    DemoService,
  ],
})
export class DemoModule {}
