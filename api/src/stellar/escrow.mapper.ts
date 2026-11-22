import type { TwDeployDto } from './tw.client.js';
import { pantallaAStroops, stroopsAUsdc } from './escala.js';

export interface RolesCuentas { verificador: string; tesoro: string; adminTw: string; mediador: string }
export interface ContratoParaMapear {
  id: string;
  folioHash: string;
  montoUsdc: number;
  montoDuenoUsdc: number;
  comisionUsdc: number;
  garantiaUsdc: number;
  dueno: string | null | undefined;
  inquilino: string | null | undefined;
}
export interface EntradaMapper {
  contrato: ContratoParaMapear;
  roles: RolesCuentas;
  escala: number;
  trustline: TwDeployDto['trustline'];
}

export class MapperError extends Error {
  readonly codigo = 'ESCROW_MAPEO_INVALIDO';
}

const aNumero = (s: bigint) => Number(stroopsAUsdc(s));

/**
 * Contrato de Utama -> DTO de deploy de TW con 3 hitos [dueño, comisión -> TESORO, garantía -> inquilino].
 * Montos en stroops (bigint): comisión y garantía se redondean y el hito del dueño es el resto, así Σ = total exacto.
 */
export function mapearEscrow({ contrato: c, roles, escala, trustline }: EntradaMapper): { dto: TwDeployDto; totalStroops: bigint; totalUsdc: number } {
  if (!c.dueno) throw new MapperError('El dueño no tiene wallet');
  if (!c.inquilino) throw new MapperError('El inquilino no tiene wallet');
  const { verificador, tesoro, adminTw, mediador } = roles;
  const otros = { VERIFICADOR: verificador, TESORO: tesoro, dueño: c.dueno, inquilino: c.inquilino };
  for (const [nombre, valor] of [['ADMIN_TW', adminTw], ['MEDIADOR', mediador]] as const) {
    const choca = Object.entries(otros).find(([, v]) => v === valor);
    if (choca) throw new MapperError(`${nombre} no puede repetir el rol ${choca[0]}`);
  }
  if (adminTw === mediador) throw new MapperError('ADMIN_TW y MEDIADOR no pueden ser la misma cuenta');

  const total = pantallaAStroops(c.montoUsdc, escala);
  const comision = pantallaAStroops(c.comisionUsdc, escala);
  const garantia = pantallaAStroops(c.garantiaUsdc, escala);
  const dueno = total - comision - garantia;
  const esperado = pantallaAStroops(c.montoDuenoUsdc, escala);
  const dif = dueno > esperado ? dueno - esperado : esperado - dueno;
  if (dueno <= 0n || dif > 2n) throw new MapperError(`La suma de los hitos no cuadra con el monto (${dueno} vs ${esperado} stroops)`);

  const dto: TwDeployDto = {
    signer: tesoro,
    engagementId: c.id,
    title: `Anticrético ${c.id}`,
    description: `Anticrético folio ${c.folioHash}`,
    roles: {
      approvers: [verificador],
      serviceProviders: [c.dueno],
      platform: tesoro,
      releaseSigners: [verificador],
      disputeResolvers: [mediador],
      admin: adminTw,
    },
    platformFee: 0,
    milestones: [
      { description: 'Inscripción DDRR: pago al dueño', amount: aNumero(dueno), receiver: c.dueno },
      { description: 'Comisión Utama', amount: aNumero(comision), receiver: tesoro },
      { description: 'Garantía: devolución al inquilino', amount: aNumero(garantia), receiver: c.inquilino },
    ],
    trustline,
  };
  return { dto, totalStroops: total, totalUsdc: aNumero(total) };
}
