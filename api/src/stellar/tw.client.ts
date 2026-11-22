/** Cliente delgado de Trustless Work V2 (multi-release). Devuelve XDR sin firmar; no firma nada. */
export class TwError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly traceId?: string,
    detail?: string,
  ) {
    super(detail ?? code);
    this.name = 'TwError';
  }
}

export interface TwMilestone { description: string; amount: number; receiver: string; status?: string; approvalsTarget?: number }
export interface TwRoles {
  approvers: string[];
  serviceProviders: string[];
  platform: string;
  releaseSigners: string[];
  disputeResolvers: string[];
  admin: string;
  observers?: string[];
}
export interface TwDeployDto {
  signer: string;
  engagementId: string;
  title: string;
  description: string;
  roles: TwRoles;
  platformFee: number;
  milestones: TwMilestone[];
  trustline: { contractId: string } | { symbol: string; address: string };
}
export interface TwUnsigned { unsignedXdr: string; txHash?: string; contractId?: string }
export interface TwSent { txHash: string; ledger?: number; code?: string; contractId?: string; escrow?: unknown }

interface Opts {
  url: string;
  apiKey: string;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Tiempo máximo por petición (la API beta de TW a veces no responde). Por defecto 25 s. */
  timeoutMs?: number;
}

const ENVIO = '/stellar/send-transaction';
const esTimeout = (e: any) => e?.name === 'TimeoutError' || e?.name === 'AbortError';

const BASE = '/escrow/multi-release/v2';

export class TwClient {
  private readonly url: string;
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  constructor(private readonly o: Opts) {
    this.url = o.url.replace(/\/+$/, '');
    this.fetchFn = o.fetchFn ?? fetch;
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  private async req<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    for (let intento = 0; ; intento++) {
      let res: Response;
      try {
        res = await this.fetchFn(`${this.url}${path}`, {
          method,
          headers: { 'x-api-key': this.o.apiKey, 'content-type': 'application/json', accept: 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(this.o.timeoutMs ?? 25_000),
        });
      } catch (e) {
        // Un timeout se reintenta una vez, salvo el envío de una tx firmada (podría haberse enviado ya).
        if (esTimeout(e) && intento < 1 && path !== ENVIO) continue;
        if (esTimeout(e)) throw new TwError('TW_TIMEOUT', 504, undefined, 'Trustless Work no respondió a tiempo');
        throw e;
      }
      const data: any = await res.json().catch(() => ({}));
      if (res.status === 429 && intento < 2) {
        await this.sleep(500 * 2 ** intento);
        continue;
      }
      if (!res.ok) throw new TwError(data?.code ?? data?.title ?? `HTTP_${res.status}`, res.status, data?.traceId, data?.detail);
      return data as T;
    }
  }

  deploy(dto: TwDeployDto) { return this.req<TwUnsigned>('POST', `${BASE}/deploy`, dto); }
  fund(dto: { contractId: string; signer: string; amount: number }) { return this.req<TwUnsigned>('POST', `${BASE}/fund`, dto); }
  approveAndRelease(dto: { contractId: string; signer: string; milestoneIndexes: number[] }) {
    return this.req<TwUnsigned>('POST', `${BASE}/approve-and-release-milestones`, dto);
  }
  dispute(dto: { contractId: string; signer: string; milestoneIndexes: number[]; reason: string }) {
    return this.req<TwUnsigned>('POST', `${BASE}/dispute-milestones`, dto);
  }
  resolveDispute(dto: { contractId: string; disputeResolver: string; milestoneIndexes: number[]; distributions: { address: string; amount: number }[] }) {
    return this.req<TwUnsigned>('POST', `${BASE}/resolve-dispute`, dto);
  }
  getEscrow(contractId: string) { return this.req<any>('GET', `${BASE}/${contractId}`); }
  sendTransaction(signedXdr: string) { return this.req<TwSent>('POST', '/stellar/send-transaction', { signedXdr }); }
}
