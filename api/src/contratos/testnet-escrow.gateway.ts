import { Logger } from '@nestjs/common';
import { errorApi } from '../common/errores.js';
import { neto, type AlPaso, type ContratoEscrow, type EscrowGateway, type OnchainVista, type OpcionesAprobar, type ResultadoAprobar } from './escrow.gateway.js';
import { mapearEscrow, MapperError } from '../stellar/escrow.mapper.js';
import { ROLES, type Rol, type StellarConfig } from '../stellar/stellar.config.js';
import type { Firmante } from '../stellar/firmante.js';
import type { Resultado } from '../stellar/enviador.js';
import type { FolioOnchain, Motivo } from '../stellar/folios.client.js';
import type { TwClient } from '../stellar/tw.client.js';
import { redondear } from '../common/util.js';
import { pantallaAStroops, stroopsAUsdc } from '../stellar/escala.js';

const DIAS_MAX_BLOQUEO = 1826;
const EPS = 1e-6;

export interface TestnetDeps {
  cfg: Pick<StellarConfig, 'escala' | 'assetCode' | 'assetIssuer' | 'assetContractId' | 'secretos'>;
  tw: Pick<TwClient, 'deploy' | 'fund' | 'approveAndRelease' | 'dispute' | 'resolveDispute' | 'getEscrow'>;
  folios: {
    simularBloquear(h: string, inq: string, escrow: string, vence: number): Promise<void>;
    bloquear(h: string, inq: string, escrow: string, vence: number): Promise<Resultado>;
    liberar(h: string, m: Motivo): Promise<{ txHash: string | null; yaLibre?: boolean }>;
    consultar(h: string): Promise<FolioOnchain | null>;
  };
  enviador: {
    enviarPorTw(xdr: string, rol: Rol): Promise<Resultado>;
    pagoUsdc(origen: Rol, destino: string, monto: number): Promise<Resultado>;
  };
  firmante: Firmante;
  /** Saldo del asset (unidades on-chain) de una cuenta, vía Horizon. */
  saldoUsdc(wallet: string): Promise<number>;
  /**
   * Saldo del asset (unidades on-chain) que tiene el contrato del escrow, leído en la cadena (SAC `balance`).
   * El `balance` de la API de Trustless Work no se actualiza tras el fund (visto en testnet), así que no basta.
   */
  saldoEscrow?(escrowId: string): Promise<number>;
  /** Auditoría opcional de cada tx enviada (éxito o fallo). Un fallo aquí nunca rompe la operación. */
  registrar?(op: OperacionRegistro): Promise<void>;
}

export interface OperacionRegistro {
  contratoId?: string | null;
  tipo: string;
  rol?: string | null;
  txHash?: string | null;
  estado: 'CONFIRMADA' | 'FALLIDA';
  error?: string | null;
  modo: string;
}

const num = (v: unknown) => Number(v ?? 0) || 0;
const liberado = (m: any) => m?.flags?.released === true || m?.released === true || m?.status === 'released';

/** Escrow real: Trustless Work (multi-release V2) + contrato utama-folios. Cada paso persiste vía `alPaso`. */
export class TestnetEscrowGateway implements EscrowGateway {
  readonly modo = 'testnet' as const;
  private mapa: Map<string, Rol> | null = null;
  private readonly log = new Logger(TestnetEscrowGateway.name);

  constructor(private readonly d: TestnetDeps) {}

  /** Wallet G… -> rol que la firma (solo las cuentas con STELLAR_SECRET_* configurado). */
  cuentas(): Map<string, Rol> {
    if (!this.mapa) {
      const m = new Map<string, Rol>();
      for (const r of ROLES) {
        if (!this.d.cfg.secretos[r]) continue;
        try {
          m.set(this.d.firmante.direccion(r), r);
        } catch {
          // secreto inválido: se ignora aquí; fallará al firmar con un mensaje claro
        }
      }
      this.mapa = m;
    }
    return this.mapa;
  }

  private rolDe(wallet: string | null | undefined, quien: string): Rol {
    const r = wallet ? this.cuentas().get(wallet) : undefined;
    if (!r) throw errorApi(400, 'NO_ES_CUSTODIAL', `La wallet del ${quien} no es custodial: debe firmar desde su navegador.`);
    return r;
  }

  private mapear(c: ContratoEscrow) {
    const wallet = (w: string | null | undefined, q: string) => {
      if (!w) throw errorApi(400, 'SIN_WALLET', `El ${q} no tiene wallet`);
      return w;
    };
    wallet(c.dueno?.wallet, 'dueño');
    wallet(c.inquilino?.wallet, 'inquilino');
    try {
      return mapearEscrow({
        contrato: {
          id: c.id,
          folioHash: c.folioHash,
          montoUsdc: c.montoUsdc,
          montoDuenoUsdc: c.montoDuenoUsdc,
          comisionUsdc: c.comisionUsdc,
          garantiaUsdc: c.garantiaUsdc,
          dueno: c.dueno?.wallet,
          inquilino: c.inquilino?.wallet,
        },
        roles: {
          verificador: this.d.firmante.direccion('VERIFICADOR'),
          tesoro: this.d.firmante.direccion('TESORO'),
          adminTw: this.d.firmante.direccion('ADMIN_TW'),
          mediador: this.d.firmante.direccion('MEDIADOR'),
        },
        escala: this.d.cfg.escala,
        trustline: { symbol: this.d.cfg.assetCode, address: this.d.cfg.assetIssuer },
      });
    } catch (e) {
      if (e instanceof MapperError) throw errorApi(400, 'ESCROW_MAPEO_INVALIDO', e.message);
      throw e;
    }
  }

  private vence(c: ContratoEscrow): number {
    const tope = Date.now() + DIAS_MAX_BLOQUEO * 86_400_000;
    return Math.floor(Math.min(c.vencimiento?.getTime() ?? tope, tope) / 1000);
  }

  /** Saldo real del escrow: el mayor entre lo que dice TW y lo que hay en la cadena. */
  private async balanceEscrow(escrowId: string, e: any): Promise<number> {
    const tw = num(e?.balance);
    return this.d.saldoEscrow ? Math.max(tw, await this.d.saldoEscrow(escrowId)) : tw;
  }

  /** Ejecuta una tx y la registra (CONFIRMADA/FALLIDA) si hay `registrar`; el error original se relanza intacto. */
  private async op<T extends { txHash?: string | null }>(c: { id?: string }, tipo: string, rol: string | null, fn: () => Promise<T>): Promise<T> {
    const anotar = async (o: Pick<OperacionRegistro, 'estado' | 'txHash' | 'error'>) => {
      if (!this.d.registrar) return;
      try {
        await this.d.registrar({ contratoId: c.id || null, tipo, rol, modo: this.modo, ...o });
      } catch (e) {
        this.log.warn(`No se pudo registrar la operación ${tipo}: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    let r: T;
    try {
      r = await fn();
    } catch (e) {
      await anotar({ estado: 'FALLIDA', txHash: null, error: (e instanceof Error ? e.message : String(e)).slice(0, 500) });
      throw e;
    }
    await anotar({ estado: 'CONFIRMADA', txHash: r?.txHash ?? null, error: null });
    return r;
  }

  private pantalla(usdc: number) {
    return redondear(usdc * this.d.cfg.escala);
  }

  async validarCrear(c: ContratoEscrow) {
    if (!c.dueno?.wallet) throw errorApi(400, 'SIN_WALLET', 'El dueño no tiene wallet');
    if (!c.inquilino?.wallet) throw errorApi(400, 'SIN_WALLET', 'El inquilino no tiene wallet');
    // Inquilino Pollar: no tenemos su llave; firma él el depósito (fase 2), así que no se exige rol custodial.
    if (c.inquilino.custodia !== 'POLLAR') this.rolDe(c.inquilino.wallet, 'inquilino');
    const { totalUsdc } = this.mapear({ ...c, id: c.id || 'validacion' });
    // Antes de gastar nada (deploy, bloqueo): si no alcanza el saldo, el folio no queda bloqueado en vano.
    if ((await this.d.saldoUsdc(c.inquilino.wallet)) + EPS < totalUsdc) {
      throw errorApi(400, 'SALDO_INSUFICIENTE', `El inquilino no tiene ${c.montoUsdc} USDC (en la escala de la demo) para depositar.`);
    }
    // Un escrow cualquiera (el TESORO) basta: la simulación solo comprueba si el folio ya está bloqueado.
    await this.d.folios.simularBloquear(c.folioHash, c.inquilino.wallet, this.d.firmante.direccion('TESORO'), this.vence(c));
  }

  async crear(c: ContratoEscrow, alPaso: AlPaso = async () => {}) {
    const { dto, totalUsdc } = this.mapear(c);
    const inquilino = c.inquilino!.wallet!;
    const salida = { escrowId: c.escrowId, txEscrow: '', txBloqueo: '', txDeposito: '' };
    const pago = `${c.montoUsdc} USDC`;
    let paso = c.paso ?? null;

    if (!paso && !c.escrowId) {
      const u = await this.d.tw.deploy(dto);
      const r = await this.op(c, 'tw.deploy', 'TESORO', () => this.d.enviador.enviarPorTw(u.unsignedXdr, 'TESORO'));
      const escrowId = r.contractId ?? u.contractId;
      if (!escrowId) throw new Error('Trustless Work no devolvió el contractId del escrow');
      salida.escrowId = escrowId;
      salida.txEscrow = r.txHash;
      paso = 'ESCROW_CREADO';
      await alPaso({ paso, tipo: 'ESCROW_CREADO', detalle: 'Escrow multi-release (3 hitos: dueño, comisión, garantía)', txHash: r.txHash, escrowId });
    }
    const escrowId = salida.escrowId!;

    if (paso === 'ESCROW_CREADO' || (!paso && c.escrowId)) {
      // Recuperación: si la tx de bloqueo entró pero `alPaso` falló, el folio ya está bloqueado con este escrow.
      const f = await this.d.folios.consultar(c.folioHash);
      const yaBloqueado = f?.estado === 'Bloqueado' && f.escrow === escrowId;
      const txBloqueo = yaBloqueado ? null : (await this.op(c, 'folios.bloquear', 'VERIFICADOR', () => this.d.folios.bloquear(c.folioHash, inquilino, escrowId, this.vence(c)))).txHash;
      salida.txBloqueo = txBloqueo ?? '';
      paso = 'FOLIO_BLOQUEADO';
      await alPaso({ paso, tipo: 'FOLIO_BLOQUEADO', detalle: 'Folio bloqueado (utama-folios.bloquear)', txHash: txBloqueo });
    }

    // Pollar: el backend se detiene aquí; el inquilino firma el `fund` (deposito/xdr + deposito/confirmar).
    if (c.inquilino?.custodia === 'POLLAR') return salida;

    if (paso === 'FOLIO_BLOQUEADO') {
      // Nunca se re-fondea a ciegas: si el escrow ya cubre el total, el fund anterior sí entró.
      const e = await this.d.tw.getEscrow(escrowId);
      if ((await this.balanceEscrow(escrowId, e)) + EPS < totalUsdc) {
        if ((await this.d.saldoUsdc(inquilino)) + EPS < totalUsdc) {
          throw errorApi(400, 'SALDO_INSUFICIENTE', `El inquilino no tiene ${pago} (en la escala de la demo) para depositar.`);
        }
        const u = await this.d.tw.fund({ contractId: escrowId, signer: inquilino, amount: totalUsdc });
        const rolInq = this.rolDe(inquilino, 'inquilino');
        const r = await this.op(c, 'tw.fund', rolInq, () => this.d.enviador.enviarPorTw(u.unsignedXdr, rolInq));
        salida.txDeposito = r.txHash;
      }
      paso = 'FONDEADO';
      const detalle = `El inquilino depositó ${pago} en el escrow: ${c.montoDuenoUsdc} al dueño, ${c.comisionUsdc} de comisión, ${c.garantiaUsdc} de garantía.`;
      await alPaso({ paso, tipo: 'DEPOSITO', detalle, txHash: salida.txDeposito || null });
    }
    return salida;
  }

  async prepararDeposito(c: ContratoEscrow) {
    const escrowId = this.exigirEscrow(c);
    const inquilino = c.inquilino?.wallet;
    if (!inquilino) throw errorApi(400, 'SIN_WALLET', 'El inquilino no tiene wallet');
    const { totalUsdc } = this.mapear(c);
    // Nunca se pide otro fund si el escrow ya cubre el total.
    if ((await this.balanceEscrow(escrowId, await this.d.tw.getEscrow(escrowId))) + EPS >= totalUsdc) {
      throw errorApi(409, 'ESTADO_INVALIDO', 'El escrow ya está fondeado: confirma el depósito.');
    }
    const u = await this.d.tw.fund({ contractId: escrowId, signer: inquilino, amount: totalUsdc });
    return { unsignedXdr: u.unsignedXdr, escrowId, montoUsdc: c.montoUsdc };
  }

  async verificarDeposito(c: ContratoEscrow, _txHash: string) {
    const escrowId = this.exigirEscrow(c);
    const { totalUsdc } = this.mapear(c);
    return (await this.balanceEscrow(escrowId, await this.d.tw.getEscrow(escrowId))) + EPS >= totalUsdc;
  }

  async abortarCreacion(c: ContratoEscrow, alPaso: AlPaso = async () => {}) {
    if (!c.escrowId) return;
    const e = await this.d.tw.getEscrow(c.escrowId);
    // Con fondos en el escrow (o paso FONDEADO) hay que devolverlos: cancelación completa, no basta liberar el folio.
    if (c.paso === 'FONDEADO' || (await this.balanceEscrow(c.escrowId, e)) > EPS) {
      await this.cancelar(c, 'Creación abortada', alPaso);
      return;
    }
    if (c.paso === 'ESCROW_CREADO' || c.paso === 'FOLIO_BLOQUEADO') {
      const f = await this.d.folios.consultar(c.folioHash);
      if (f?.escrow !== c.escrowId) return; // el folio no es de este escrow (libre u ocupado por otro): no se toca
      const r = await this.op(c, 'folios.liberar', 'VERIFICADOR', () => this.d.folios.liberar(c.folioHash, 'SinFondeo'));
      await alPaso({ paso: 'FOLIO_LIBERADO', tipo: 'FOLIO_LIBERADO', detalle: 'Folio liberado (SinFondeo)', txHash: r.txHash });
    }
  }

  private async enviar(unsigned: { unsignedXdr: string }, rol: Rol, c: { id?: string }, tipo: string) {
    return this.op(c, tipo, rol, () => this.d.enviador.enviarPorTw(unsigned.unsignedXdr, rol));
  }

  async liberarInscripcion(c: ContratoEscrow) {
    const escrowId = this.exigirEscrow(c);
    const e = await this.d.tw.getEscrow(escrowId);
    const hitos: any[] = e?.milestones ?? [];
    let tx = '';
    if (!(liberado(hitos[0]) && liberado(hitos[1]))) {
      const signer = this.d.firmante.direccion('VERIFICADOR');
      const u = await this.d.tw.approveAndRelease({ contractId: escrowId, signer, milestoneIndexes: [0, 1] });
      tx = (await this.enviar(u, 'VERIFICADOR', c, 'tw.approveAndRelease')).txHash;
    }
    return { tx, pagadoDuenoUsdc: neto(c.montoDuenoUsdc), comisionNetaUsdc: neto(c.comisionUsdc) };
  }

  private exigirEscrow(c: ContratoEscrow): string {
    if (!c.escrowId) throw errorApi(409, 'SIN_ESCROW', 'El contrato todavía no tiene escrow on-chain.');
    return c.escrowId;
  }

  async cancelar(c: ContratoEscrow, motivo: string, alPaso: AlPaso = async () => {}) {
    const escrowId = this.exigirEscrow(c);
    const inquilino = c.inquilino?.wallet;
    if (!inquilino) throw errorApi(400, 'SIN_WALLET', 'El inquilino no tiene wallet');
    const res = { txDisputa: '', txReembolso: '', txLiberar: '', reembolsoNetoUsdc: neto(c.montoUsdc), yaRegistrado: true };
    let paso = c.paso ?? null;

    if (paso !== 'DISPUTADO' && paso !== 'REEMBOLSADO' && paso !== 'FOLIO_LIBERADO') {
      const tesoro = this.d.firmante.direccion('TESORO');
      const u = await this.d.tw.dispute({ contractId: escrowId, signer: tesoro, milestoneIndexes: [0, 1, 2], reason: motivo });
      const r = await this.enviar(u, 'TESORO', c, 'tw.dispute');
      res.txDisputa = r.txHash;
      paso = 'DISPUTADO';
      await alPaso({ paso, tipo: 'DISPUTA_ABIERTA', detalle: `Disputa abierta: ${motivo}`, txHash: r.txHash });
    }
    if (paso === 'DISPUTADO') {
      const mediador = this.d.firmante.direccion('MEDIADOR');
      const { totalUsdc } = this.mapear(c);
      const u = await this.d.tw.resolveDispute({
        contractId: escrowId,
        disputeResolver: mediador,
        milestoneIndexes: [0, 1, 2],
        distributions: [{ address: inquilino, amount: totalUsdc }],
      });
      const r = await this.enviar(u, 'MEDIADOR', c, 'tw.resolveDispute');
      res.txReembolso = r.txHash;
      paso = 'REEMBOLSADO';
      await alPaso({
        paso,
        tipo: 'REEMBOLSO',
        detalle: `Se devuelven ${res.reembolsoNetoUsdc} al inquilino (neto de 0,3 % de Trustless Work)`,
        txHash: r.txHash,
      });
    }
    if (paso === 'REEMBOLSADO') {
      const l = await this.op(c, 'folios.liberar', 'VERIFICADOR', () => this.d.folios.liberar(c.folioHash, 'Cancelado'));
      res.txLiberar = l.txHash ?? '';
      await alPaso({ paso: 'FOLIO_LIBERADO', tipo: 'FOLIO_LIBERADO', detalle: 'Folio liberado (Cancelado)', txHash: l.txHash });
    }
    return res;
  }

  async devolver(c: ContratoEscrow, monto: number) {
    const origen = this.rolDe(c.dueno?.wallet, 'dueño');
    const destino = c.inquilino?.wallet;
    if (!destino) throw errorApi(400, 'SIN_WALLET', 'El inquilino no tiene wallet');
    try {
      const r = await this.op(c, 'pago', origen, () => this.d.enviador.pagoUsdc(origen, destino, monto));
      return { tx: r.txHash };
    } catch (e: any) {
      const codigos = JSON.stringify(e?.response?.data?.extras?.result_codes ?? e?.message ?? '');
      if (codigos.includes('op_underfunded')) {
        throw errorApi(400, 'SALDO_INSUFICIENTE', 'El dueño no tiene saldo suficiente para devolver el anticrético.');
      }
      throw e;
    }
  }

  async aprobar(c: ContratoEscrow, opc: OpcionesAprobar = {}): Promise<ResultadoAprobar> {
    const escrowId = this.exigirEscrow(c);
    if ((opc.danosUsdc ?? 0) > 0) return this.aprobarConDanos(c, escrowId, opc.danosUsdc!, opc.alPaso);
    const e = await this.d.tw.getEscrow(escrowId);
    let txGarantia = '';
    if (!liberado((e?.milestones ?? [])[2])) {
      const signer = this.d.firmante.direccion('VERIFICADOR');
      const u = await this.d.tw.approveAndRelease({ contractId: escrowId, signer, milestoneIndexes: [2] });
      txGarantia = (await this.enviar(u, 'VERIFICADOR', c, 'tw.approveAndRelease')).txHash;
    }
    const l = await this.op(c, 'folios.liberar', 'VERIFICADOR', () => this.d.folios.liberar(c.folioHash, 'Finalizado'));
    return { txGarantia, txLiberar: l.txHash ?? '', garantiaNetaUsdc: neto(c.garantiaUsdc) };
  }

  /** Daños en el check-out: dispute [2] (TESORO) -> resolve (MEDIADOR) con el reparto -> liberar(Finalizado). Reanudable por `paso`. */
  private async aprobarConDanos(c: ContratoEscrow, escrowId: string, danos: number, alPaso: AlPaso = async () => {}): Promise<ResultadoAprobar> {
    const dueno = c.dueno?.wallet;
    const inquilino = c.inquilino?.wallet;
    if (!dueno || !inquilino) throw errorApi(400, 'SIN_WALLET', 'El dueño o el inquilino no tiene wallet');
    const res: ResultadoAprobar = {
      txDisputa: '', txGarantia: '', txLiberar: '',
      garantiaNetaUsdc: neto(redondear(c.garantiaUsdc - danos)), danosNetoUsdc: neto(danos), yaRegistrado: true,
    };
    let paso = c.paso ?? null;

    if (paso !== 'DANOS_DISPUTADO' && paso !== 'DANOS_RESUELTO' && paso !== 'FOLIO_LIBERADO') {
      const u = await this.d.tw.dispute({ contractId: escrowId, signer: this.d.firmante.direccion('TESORO'), milestoneIndexes: [2], reason: 'Daños en check-out' });
      const r = await this.enviar(u, 'TESORO', c, 'tw.dispute');
      res.txDisputa = r.txHash;
      paso = 'DANOS_DISPUTADO';
      await alPaso({ paso, tipo: 'DISPUTA_ABIERTA', detalle: 'Disputa abierta: Daños en check-out', txHash: r.txHash });
    }
    if (paso === 'DANOS_DISPUTADO') {
      const esc = this.d.cfg.escala;
      const garantia = pantallaAStroops(c.garantiaUsdc, esc);
      const aDueno = pantallaAStroops(danos, esc);
      const aInquilino = garantia - aDueno;
      const distributions = [
        { address: dueno, amount: Number(stroopsAUsdc(aDueno)) },
        ...(aInquilino > 0n ? [{ address: inquilino, amount: Number(stroopsAUsdc(aInquilino)) }] : []),
      ];
      const u = await this.d.tw.resolveDispute({
        contractId: escrowId,
        disputeResolver: this.d.firmante.direccion('MEDIADOR'),
        milestoneIndexes: [2],
        distributions,
      });
      const r = await this.enviar(u, 'MEDIADOR', c, 'tw.resolveDispute');
      res.txGarantia = r.txHash;
      paso = 'DANOS_RESUELTO';
      await alPaso({
        paso,
        tipo: 'GARANTIA_LIBERADA',
        detalle: `Garantía repartida: ${res.garantiaNetaUsdc} al inquilino y ${res.danosNetoUsdc} al dueño por daños (neto de 0,3 % de Trustless Work)`,
        txHash: r.txHash,
      });
    }
    if (paso === 'DANOS_RESUELTO') {
      const l = await this.op(c, 'folios.liberar', 'VERIFICADOR', () => this.d.folios.liberar(c.folioHash, 'Finalizado'));
      res.txLiberar = l.txHash ?? '';
      await alPaso({ paso: 'FOLIO_LIBERADO', tipo: 'FOLIO_LIBERADO', detalle: 'Folio liberado (Finalizado)', txHash: l.txHash });
    }
    return res;
  }

  async onchain(c: ContratoEscrow): Promise<OnchainVista> {
    const e = c.escrowId ? await this.d.tw.getEscrow(c.escrowId) : null;
    const folio = await this.d.folios.consultar(c.folioHash);
    const hitos: any[] = e?.milestones ?? [];
    return {
      saldoEscrowUsdc: this.pantalla(c.escrowId ? await this.balanceEscrow(c.escrowId, e) : 0),
      hitos: hitos.map((m, i) => ({
        indice: i,
        descripcion: String(m.description ?? ''),
        montoUsdc: this.pantalla(num(m.amount)),
        receptor: String(m.receiver ?? ''),
        liberado: liberado(m),
      })),
      folioOcupado: folio?.estado === 'Bloqueado',
    };
  }
}
