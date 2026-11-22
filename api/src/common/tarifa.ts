/** Tarifa de verificación del folio, en monto de pantalla (`TARIFA_VERIFICACION_USDC`, por defecto 30). */
export const tarifaVerificacionUsdc = () => Number(process.env.TARIFA_VERIFICACION_USDC ?? 30);
