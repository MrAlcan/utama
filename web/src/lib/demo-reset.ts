const DEFAULT_API_URL = 'http://localhost:3001/api';

export type DemoResetEnv = {
  NEXT_PUBLIC_API_URL?: string;
  DEMO_RESET_TOKEN?: string;
  [key: string]: string | undefined;
};

export async function reenviarDemoReset(
  fetchImpl: typeof fetch = fetch,
  env: DemoResetEnv = process.env,
): Promise<Response> {
  const apiBase = (env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '');
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (env.DEMO_RESET_TOKEN) {
    headers['x-demo-token'] = env.DEMO_RESET_TOKEN;
  }

  let upstream: Response;
  try {
    upstream = await fetchImpl(`${apiBase}/demo/reset`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
      cache: 'no-store',
    });
  } catch {
    return Response.json(
      { message: 'No se pudo conectar con el servidor de Utama para reiniciar la demo.' },
      { status: 502 },
    );
  }

  const texto = await upstream.text();
  const contentType = upstream.headers.get('content-type') ?? 'application/json';
  return new Response(texto || JSON.stringify({ ok: upstream.ok }), {
    status: upstream.status,
    headers: { 'content-type': contentType },
  });
}
