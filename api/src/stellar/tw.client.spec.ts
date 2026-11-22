import { describe, expect, it, vi } from 'vitest';
import { TwClient, TwError } from './tw.client.js';

const resp = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
const mk = (fetchFn: any) => new TwClient({ url: 'https://tw.test/', apiKey: 'k.s', fetchFn, sleep: async () => {} });

describe('TwClient', () => {
  it('deploy: POST con x-api-key y devuelve el XDR', async () => {
    const f = vi.fn().mockResolvedValue(resp(200, { unsignedXdr: 'AAA', txHash: 'h', contractId: 'C1' }));
    const r = await mk(f).deploy({ signer: 'G1' } as any);
    expect(r).toEqual({ unsignedXdr: 'AAA', txHash: 'h', contractId: 'C1' });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://tw.test/escrow/multi-release/v2/deploy');
    expect(init.method).toBe('POST');
    expect(init.headers['x-api-key']).toBe('k.s');
    expect(JSON.parse(init.body)).toEqual({ signer: 'G1' });
  });
  it('rutas y bodies de las demás acciones', async () => {
    const f = vi.fn().mockImplementation(async () => resp(200, { ok: 1 }));
    const c = mk(f);
    await c.fund({ contractId: 'C', signer: 'G', amount: 30 });
    await c.approveAndRelease({ contractId: 'C', signer: 'G', milestoneIndexes: [0, 1] });
    await c.dispute({ contractId: 'C', signer: 'G', milestoneIndexes: [0], reason: 'x' });
    await c.resolveDispute({ contractId: 'C', disputeResolver: 'G', milestoneIndexes: [0], distributions: [{ address: 'G', amount: 1 }] });
    await c.getEscrow('C');
    await c.sendTransaction('SIGNED');
    expect(f.mock.calls.map((x) => x[0].replace('https://tw.test', ''))).toEqual([
      '/escrow/multi-release/v2/fund',
      '/escrow/multi-release/v2/approve-and-release-milestones',
      '/escrow/multi-release/v2/dispute-milestones',
      '/escrow/multi-release/v2/resolve-dispute',
      '/escrow/multi-release/v2/C',
      '/stellar/send-transaction',
    ]);
    expect(f.mock.calls[4][1].method).toBe('GET');
    expect(JSON.parse(f.mock.calls[5][1].body)).toEqual({ signedXdr: 'SIGNED' });
  });
  it('Problem Details -> TwError', async () => {
    const f = vi.fn().mockResolvedValue(resp(422, { status: 422, code: 'ESCROW_RECEIVER_TRUSTLINE_MISSING', detail: 'd', traceId: 't1' }));
    const e = await mk(f).fund({ contractId: 'C', signer: 'G', amount: 1 }).catch((x) => x);
    expect(e).toBeInstanceOf(TwError);
    expect(e).toMatchObject({ code: 'ESCROW_RECEIVER_TRUSTLINE_MISSING', status: 422, traceId: 't1' });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('429 reintenta con backoff máx. 2 veces', async () => {
    const f = vi.fn().mockResolvedValueOnce(resp(429, { code: 'TOO_MANY_REQUESTS' })).mockResolvedValueOnce(resp(429, { code: 'TOO_MANY_REQUESTS' })).mockResolvedValueOnce(resp(200, { txHash: 'ok' }));
    expect(await mk(f).sendTransaction('x')).toEqual({ txHash: 'ok' });
    expect(f).toHaveBeenCalledTimes(3);
    const g = vi.fn().mockResolvedValue(resp(429, { code: 'TOO_MANY_REQUESTS' }));
    await expect(mk(g).sendTransaction('x')).rejects.toMatchObject({ status: 429, code: 'TOO_MANY_REQUESTS' });
    expect(g).toHaveBeenCalledTimes(3);
  });
});
