import { Address, BASE_FEE, Contract, Keypair, Operation, SorobanDataBuilder, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import { errorApi } from '../common/errores.js';
import { KeypairFirmante, type Firmante } from './firmante.js';
import { Enviador, type Resultado } from './enviador.js';
import { MultifirmaInvocador } from './multifirma.js';
import type { StellarConfig } from './stellar.config.js';

export type Motivo = 'Finalizado' | 'Cancelado' | 'SinFondeo';
export interface FolioOnchain {
  dueno: string;
  estado: 'Libre' | 'Bloqueado';
  atestadoEn: number;
  inquilino: string | null;
  escrow: string | null;
  vence: number;
}

interface Deps {
  rpc: any;
  enviador: { enviarPorRpc(xdr: string, rol: 'VERIFICADOR' | 'TESORO'): Promise<Resultado> };
  /** Por defecto `rpc.assembleTransaction`; inyectable para pruebas. */
  ensamblar?: (tx: any, sim: any) => { build(): any };
  /** Solo v2 (F2-10): quién firma y cómo se invoca con varias firmas. */
  multifirma?: { firmantes(): string[]; invocar(metodo: string, args: Record<string, unknown>): Promise<Resultado> };
}

type Config = Pick<StellarConfig, 'passphrase' | 'foliosContractId'> & Partial<Pick<StellarConfig, 'foliosVersion'>>;

/** hex de 64 caracteres -> BytesN<32>. */
export function hexABytes32(hex: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('El hash del folio debe ser hex de 64 caracteres');
  return Buffer.from(hex, 'hex');
}

/** Errores del contrato utama-folios (`Error(Contract, #n)`) a códigos de la API. */
export function mapearErrorContrato(msg: string): ReturnType<typeof errorApi> | null {
  const m = /Error\(Contract, #(\d+)\)/.exec(msg);
  if (!m) return null;
  const n = Number(m[1]);
  if (n === 2) return errorApi(409, 'FOLIO_OCUPADO', 'El folio ya tiene un anticrético vigente', { onchain: true });
  if (n === 3) return errorApi(409, 'FOLIO_LIBRE', 'El folio no está bloqueado', { onchain: true });
  if (n === 7) return errorApi(502, 'FIRMAS_INSUFICIENTES', 'El contrato de folios v2 exige más firmas de verificadores', { onchain: true });
  return errorApi(502, 'ONCHAIN_ERROR', `El contrato de folios rechazó la operación (#${n})`, { onchain: true });
}

const bytes = (hex: string) => xdr.ScVal.scvBytes(hexABytes32(hex));
const addr = (a: string) => new Address(a).toScVal();
const u64 = (n: number | bigint) => nativeToScVal(BigInt(n), { type: 'u64' });
const motivoSc = (m: Motivo) => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(m)]);

/**
 * Cliente del contrato de folios.
 * v1 (`utama-folios`): las escrituras las firma el VERIFICADOR (admin único).
 * v2 (`utama-folios-v2`, F2-10): `atestar_folio`, `bloquear` y `liberar` reciben `firmantes` como 1.er argumento
 * y se firman con el quórum (VERIFICADOR + verificadores extra) vía `deps.multifirma`. `consultar` no cambia.
 */
export class FoliosClient {
  private readonly v2: boolean;
  constructor(
    private readonly cfg: Config,
    private readonly firmante: Firmante,
    private readonly deps: Deps,
  ) {
    this.v2 = cfg.foliosVersion === 2;
    if (this.v2 && !deps?.multifirma) throw new Error('FOLIOS_VERSION=2 requiere la multifirma configurada (verificadores extra)');
  }

  /** En v2 antepone `firmantes` a los argumentos de una escritura. */
  private conFirmantes(args: xdr.ScVal[]): xdr.ScVal[] {
    return this.v2 ? [xdr.ScVal.scvVec(this.deps.multifirma!.firmantes().map(addr)), ...args] : args;
  }

  /** Escritura: v1 por el enviador (firma VERIFICADOR); v2 simula (mismos errores que v1) y luego invoca con quórum. */
  private async escribir(metodo: string, args: xdr.ScVal[], nativos: Record<string, unknown>): Promise<Resultado> {
    if (!this.v2) return this.ejecutar(metodo, args);
    const mf = this.deps.multifirma!;
    await this.simular(metodo, this.conFirmantes(args));
    try {
      return await mf.invocar(metodo, { firmantes: mf.firmantes(), ...nativos });
    } catch (e: any) {
      if (e?.response?.codigo) throw e;
      throw mapearErrorContrato(String(e?.message ?? e)) ?? errorApi(502, 'ONCHAIN_ERROR', `Falló ${metodo} en el contrato de folios v2`, { onchain: true });
    }
  }

  private async construir(metodo: string, args: xdr.ScVal[]) {
    const cuenta = await this.deps.rpc.getAccount(this.firmante.direccion('VERIFICADOR'));
    return new TransactionBuilder(cuenta, { fee: BASE_FEE, networkPassphrase: this.cfg.passphrase })
      .addOperation(new Contract(this.cfg.foliosContractId).call(metodo, ...args))
      .setTimeout(60)
      .build();
  }

  /** Simula; si el contrato falla lanza el error de API correspondiente. */
  private async simular(metodo: string, args: xdr.ScVal[]) {
    const tx = await this.construir(metodo, args);
    const sim = await this.deps.rpc.simulateTransaction(tx);
    if (sim.error) {
      throw mapearErrorContrato(String(sim.error)) ?? errorApi(502, 'ONCHAIN_ERROR', `Falló la simulación de ${metodo}`, { onchain: true });
    }
    return { tx, sim };
  }

  private async ejecutar(metodo: string, args: xdr.ScVal[]): Promise<Resultado> {
    const { tx, sim } = await this.simular(metodo, args);
    const ensamblar = this.deps.ensamblar ?? ((t, s) => rpc.assembleTransaction(t, s));
    return this.deps.enviador.enviarPorRpc(ensamblar(tx, sim).build().toXDR(), 'VERIFICADOR');
  }

  /** Solo simula `bloquear`: lanza FOLIO_OCUPADO (onchain) si el folio ya está bloqueado. */
  async simularBloquear(hashHex: string, inquilino: string, escrow: string, venceUnix: number): Promise<void> {
    await this.simular('bloquear', this.conFirmantes([bytes(hashHex), addr(inquilino), addr(escrow), u64(venceUnix)]));
  }

  atestar(hashHex: string, dueno: string): Promise<Resultado> {
    return this.escribir('atestar_folio', [bytes(hashHex), addr(dueno)], { folio: hexABytes32(hashHex), dueno });
  }

  bloquear(hashHex: string, inquilino: string, escrow: string, venceUnix: number): Promise<Resultado> {
    return this.escribir('bloquear', [bytes(hashHex), addr(inquilino), addr(escrow), u64(venceUnix)], {
      folio: hexABytes32(hashHex),
      inquilino,
      escrow,
      vence: BigInt(venceUnix),
    });
  }

  /** `FolioLibre` (#3) se toma como éxito: el folio ya estaba libre. */
  async liberar(hashHex: string, motivo: Motivo): Promise<{ txHash: string | null; yaLibre?: boolean }> {
    try {
      const r = await this.escribir('liberar', [bytes(hashHex), motivoSc(motivo)], {
        folio: hexABytes32(hashHex),
        motivo: { tag: motivo, values: undefined },
      });
      return { txHash: r.txHash };
    } catch (e: any) {
      if (e?.response?.codigo === 'FOLIO_LIBRE') return { txHash: null, yaLibre: true };
      throw e;
    }
  }

  /** Saldo (stroops) de `titular` (cuenta G o contrato C) en un token SAC. Solo simula: no firma ni gasta. */
  async saldoToken(tokenId: string, titular: string): Promise<bigint> {
    const cuenta = await this.deps.rpc.getAccount(this.firmante.direccion('VERIFICADOR'));
    const tx = new TransactionBuilder(cuenta, { fee: BASE_FEE, networkPassphrase: this.cfg.passphrase })
      .addOperation(new Contract(tokenId).call('balance', addr(titular)))
      .setTimeout(60)
      .build();
    const sim = await this.deps.rpc.simulateTransaction(tx);
    if (sim.error) throw errorApi(502, 'ONCHAIN_ERROR', 'Falló la lectura del saldo del escrow', { onchain: true });
    const v = sim.result?.retval;
    return v ? BigInt(scValToNative(v)) : 0n;
  }

  /** Claves de ledger que mantienen vivo el estado: instancia del contrato + `Clave::Folio(hash)` (persistente). */
  clavesTtl(hashes: string[]): xdr.LedgerKey[] {
    const contrato = new Address(this.cfg.foliosContractId).toScAddress();
    const dato = (key: xdr.ScVal) =>
      xdr.LedgerKey.contractData(new xdr.LedgerKeyContractData({ contract: contrato, key, durability: xdr.ContractDataDurability.persistent }));
    return [dato(xdr.ScVal.scvLedgerKeyContractInstance()), ...hashes.map((h) => dato(xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Folio'), bytes(h)])))];
  }

  /**
   * H-04 (SEGURIDAD.md): el contrato solo extiende el TTL al escribir; un bloqueo largo sin escrituras se archivaría.
   * Extiende hasta `extenderA` ledgers las entradas que vencen en menos de `umbral` ledgers (`ExtendFootprintTTL`,
   * lo puede pagar cualquiera: paga el TESORO). Lo que no aparece (folio sin atestar o ya archivado) se informa en
   * `sinEntrada`; un archivado se recupera con `stellar contract restore` (no se pierde el bloqueo).
   */
  async extenderTtl(hashes: string[], o: { umbral: number; extenderA: number }) {
    const unicos = [...new Set(hashes)];
    const claves = this.clavesTtl(unicos);
    const vivas = new Map<string, number>();
    for (let i = 0; i < claves.length; i += 100) {
      const r = await this.deps.rpc.getLedgerEntries(...claves.slice(i, i + 100));
      for (const e of r.entries ?? []) vivas.set(e.key.toXDR('base64'), Number(e.liveUntilLedgerSeq));
    }
    const ultimo = Number((await this.deps.rpc.getLatestLedger()).sequence);
    const porExtender = claves.filter((k) => {
      const vence = vivas.get(k.toXDR('base64'));
      return vence !== undefined && vence - ultimo < o.umbral;
    });
    const sinEntrada = unicos.filter((_, i) => !vivas.has(claves[i + 1].toXDR('base64')));
    const base = { revisados: claves.length, extendidos: porExtender.length, sinEntrada };
    if (!porExtender.length) return { ...base, txHash: null as string | null };

    const cuenta = await this.deps.rpc.getAccount(this.firmante.direccion('TESORO'));
    const tx = new TransactionBuilder(cuenta, { fee: BASE_FEE, networkPassphrase: this.cfg.passphrase })
      .setSorobanData(new SorobanDataBuilder().setReadOnly(porExtender).build())
      .addOperation(Operation.extendFootprintTtl({ extendTo: o.extenderA }))
      .setTimeout(60)
      .build();
    const sim = await this.deps.rpc.simulateTransaction(tx);
    if (sim.error) throw errorApi(502, 'ONCHAIN_ERROR', 'Falló la simulación de la extensión de TTL', { onchain: true });
    const ensamblar = this.deps.ensamblar ?? ((t, s) => rpc.assembleTransaction(t, s));
    const r = await this.deps.enviador.enviarPorRpc(ensamblar(tx, sim).build().toXDR(), 'TESORO');
    return { ...base, txHash: r.txHash as string | null };
  }

  async consultar(hashHex: string): Promise<FolioOnchain | null> {
    const { sim } = await this.simular('consultar', [bytes(hashHex)]);
    const retval = sim.result?.retval;
    if (!retval) return null;
    const f = scValToNative(retval) as any;
    if (f == null) return null;
    return {
      dueno: f.dueno,
      estado: Array.isArray(f.estado) ? f.estado[0] : f.estado,
      atestadoEn: Number(f.atestado_en),
      inquilino: f.inquilino ?? null,
      escrow: f.escrow ?? null,
      vence: Number(f.vence),
    };
  }
}

/** Invocador multifirma del v2 (null en v1): paga y firma el VERIFICADOR, más los verificadores extra. */
export function crearMultifirma(cfg: StellarConfig): MultifirmaInvocador | null {
  if (cfg.foliosVersion !== 2) return null;
  const s = cfg.secretos.VERIFICADOR;
  if (!s) throw new Error('Falta STELLAR_SECRET_VERIFICADOR');
  const extras = cfg.verificadoresExtra.map((x) => Keypair.fromSecret(x));
  return new MultifirmaInvocador({ contractId: cfg.foliosContractId, passphrase: cfg.passphrase, rpcUrl: cfg.rpcUrl }, Keypair.fromSecret(s), extras);
}

/** Arma un FoliosClient completo (RPC real + firmante de entorno). Lo usan el módulo, el seed y las pruebas de integración. */
export function crearFoliosClient(cfg: StellarConfig, enviador?: Enviador): FoliosClient {
  const server = new rpc.Server(cfg.rpcUrl, { allowHttp: cfg.rpcUrl.startsWith('http://') });
  const firmante = new KeypairFirmante(cfg.secretos, cfg.passphrase);
  return new FoliosClient(cfg, firmante, {
    rpc: server,
    enviador: enviador ?? new Enviador(cfg, firmante, { rpc: server }),
    multifirma: crearMultifirma(cfg) ?? undefined,
  });
}
