'use client';

import { usePollar } from '@pollar/react';
import { useEffect, useRef, useState } from 'react';
import { usePollarMontado } from '@/components/Proveedores';
import { useConfig } from '@/components/ReglasInmueble';
import { api, mensajeError } from '@/lib/api';
import { corto, urlCuenta, urlTx, usdc } from '@/lib/format';
import {
  calcularMontoPagoVerificacion,
  interpretarResultadoPagoPollar,
  vincularUsuarioPollar,
} from '@/lib/pollar-helpers';
import { useUsuario } from '@/lib/usuario';

function PollarSesionActiva({ compacto = false }: { compacto?: boolean }) {
  const { isAuthenticated, wallet, hasWallet, createWallet, verified, login, openLoginModal, logout } = usePollar();
  const { usuarios, recargar, seleccionar } = useUsuario();
  const [errorVinculo, setErrorVinculo] = useState<string | null>(null);
  const [creandoManual, setCreandoManual] = useState(false);
  const vinculadoRef = useRef<string | null>(null);

  useEffect(() => {
    const address = wallet?.address;
    if (!isAuthenticated || !verified || !address || wallet.provisioning === 'CREATING' || wallet.provisioning === 'FAILED') {
      return;
    }
    if (vinculadoRef.current === address) return;
    vinculadoRef.current = address;

    void vincularUsuarioPollar({
      address,
      usuarios,
      cliente: api,
    })
      .then(async ({ usuarioId }) => {
        setErrorVinculo(null);
        await recargar();
        seleccionar(usuarioId);
      })
      .catch((e) => {
        vinculadoRef.current = null;
        setErrorVinculo(mensajeError(e));
      });
  }, [isAuthenticated, verified, wallet, usuarios, recargar, seleccionar]);

  async function intentarCrearWallet() {
    setCreandoManual(true);
    setErrorVinculo(null);
    try {
      await createWallet();
    } catch (e) {
      setErrorVinculo(mensajeError(e));
    } finally {
      setCreandoManual(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className={`flex items-center gap-1.5 ${compacto ? 'flex-wrap' : ''}`}>
        <button
          type="button"
          className="btn btn-sec !px-2.5 !py-1.5 text-xs"
          onClick={() => login({ provider: 'google' })}
        >
          Entrar con Google
        </button>
        <button
          type="button"
          className="text-xs font-semibold text-suave underline hover:text-terracota"
          onClick={() => openLoginModal()}
        >
          o con correo
        </button>
      </div>
    );
  }

  const falloProvision = wallet?.provisioning === 'FAILED';
  const sinWallet = !wallet && !hasWallet;
  const creando = (!wallet && hasWallet) || wallet?.provisioning === 'CREATING';

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {falloProvision ? (
        <span className="rounded-sm bg-peligro-claro px-2 py-1 font-semibold text-peligro">
          No se pudo crear la wallet (revisa Starting balance en Pollar)
        </span>
      ) : sinWallet ? (
        <button
          type="button"
          className="btn btn-sec !px-2.5 !py-1 text-xs"
          disabled={creandoManual}
          onClick={() => void intentarCrearWallet()}
        >
          {creandoManual ? 'Creando wallet…' : 'Crear wallet Stellar'}
        </button>
      ) : creando ? (
        <span
          className="rounded-sm bg-oro-claro px-2 py-1 font-semibold text-tierra"
          title="Activando cuenta en Stellar testnet. Si tarda más de 30s, revisa Starting balance > Fund in test mode en dashboard.pollar.xyz."
        >
          Creando tu wallet…{wallet?.address ? ` (${corto(wallet.address, 4)})` : ''}
        </span>
      ) : wallet?.address ? (
        <a
          className="rounded-sm bg-andino-claro px-2 py-1 font-bold text-andino underline"
          href={urlCuenta(wallet.address)}
          target="_blank"
          rel="noreferrer"
        >
          Wallet lista · {corto(wallet.address, 4)} ↗
        </a>
      ) : null}
      <button
        type="button"
        className="text-suave underline hover:text-peligro"
        onClick={() => {
          vinculadoRef.current = null;
          logout();
        }}
      >
        Salir
      </button>
      {errorVinculo && <span className="text-peligro">{errorVinculo}</span>}
    </div>
  );
}

/** Botones y estado de sesión Pollar para el Header (desktop y móvil). No se monta sin API key. */
export function PollarSesion({ compacto = false }: { compacto?: boolean }) {
  const montado = usePollarMontado();
  if (!montado) return null;
  return <PollarSesionActiva compacto={compacto} />;
}

function PagoVerificacionPollarActivo() {
  const { isAuthenticated, wallet, verified, runTx } = usePollar();
  const { usuario } = useUsuario();
  const config = useConfig();
  const [pagando, setPagando] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (
    !isAuthenticated ||
    !wallet?.address ||
    !usuario ||
    usuario.wallet !== wallet.address ||
    !config?.tesoro ||
    !config.usdc?.issuer ||
    !config.tarifaVerificacionUsdc
  ) {
    return null;
  }

  const escalaActiva = config.escala ?? 10000;
  const montoEscalado = calcularMontoPagoVerificacion(config.tarifaVerificacionUsdc, escalaActiva);

  async function pagar() {
    if (!usuario || !config?.tesoro || !config.usdc?.issuer) return;
    setPagando(true);
    setError(null);
    try {
      const outcome = await runTx('payment', {
        destination: config.tesoro,
        amount: montoEscalado,
        asset: {
          type: 'credit_alphanum4',
          code: 'USDC',
          issuer: config.usdc.issuer,
        },
      });
      const res = interpretarResultadoPagoPollar(outcome as { status?: string; hash?: string; code?: string; message?: string; details?: unknown });
      if (!res.ok) {
        setError(res.mensaje);
        return;
      }
      await api.post('/folio/pago', { usuarioId: usuario.id, txHash: res.txHash });
      setTxHash(res.txHash);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setPagando(false);
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <p className="font-bold">Pago de verificación de folio con Pollar</p>
        <p className="text-xs text-suave">
          Firma un pago real en USDC de prueba desde tu wallet Pollar ({montoEscalado} USDC a escala 1:{escalaActiva.toLocaleString('es-BO')}).
        </p>
      </div>
      <button
        type="button"
        className="btn btn-primario"
        disabled={pagando || !verified || wallet.provisioning === 'CREATING'}
        onClick={() => void pagar()}
      >
        {pagando ? 'Confirmando en Pollar…' : `Pagar la verificación del folio (${usdc(config.tarifaVerificacionUsdc)})`}
      </button>
      {txHash && (
        <p className="text-xs font-semibold text-andino">
          Pago registrado ·{' '}
          <a className="underline" href={urlTx(txHash)} target="_blank" rel="noreferrer">
            Ver en stellar.expert ↗
          </a>
        </p>
      )}
      {error && <p className="text-xs font-semibold text-peligro">{error}</p>}
    </div>
  );
}

/** Pago USDC real con Pollar (W-14). Solo visible si Pollar está activo y coincide la wallet del usuario seleccionado. */
export function PagoVerificacionPollar() {
  const montado = usePollarMontado();
  if (!montado) return null;
  return <PagoVerificacionPollarActivo />;
}
