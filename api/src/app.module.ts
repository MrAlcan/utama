import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { FolioModule } from './folio/folio.module.js';
import { MetricasModule } from './metricas/metricas.module.js';
import { ConsultaModule } from './consulta/consulta.module.js';
import { InmueblesModule } from './inmuebles/inmuebles.module.js';
import { VisitasModule } from './visitas/visitas.module.js';
import { OfertasModule } from './ofertas/ofertas.module.js';
import { ContratosModule } from './contratos/contratos.module.js';
import { InventarioModule } from './inventario/inventario.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { DemoModule } from './demo/demo.module.js';
import { ReputacionModule } from './reputacion/reputacion.module.js';
import { NotificacionesModule } from './notificaciones/notificaciones.module.js';
import { StellarModule } from './stellar/stellar.module.js';
import { VaquitaModule } from './vaquita/vaquita.module.js';

@Module({
  imports: [MetricasModule, ConsultaModule, 
    ScheduleModule.forRoot(),
    PrismaModule,
    UsuariosModule,
    FolioModule,
    InmueblesModule,
    VisitasModule,
    OfertasModule,
    ContratosModule,
    InventarioModule,
    UploadsModule,
    DemoModule,
    ReputacionModule,
    NotificacionesModule,
    StellarModule,
    VaquitaModule,
  ],
})
export class AppModule {}
