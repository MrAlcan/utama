import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { cuerpoError } from './errores.js';

/** Garantiza que todas las respuestas de error incluyan `codigo` (contrato de API v1), incluidos los errores no HTTP. */
@Catch()
export class ErroresFilter implements ExceptionFilter {
  private readonly log = new Logger('Errores');

  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (e instanceof HttpException) {
      const status = e.getStatus();
      res.status(status).json(cuerpoError(status, e.getResponse()));
      return;
    }
    this.log.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
    res.status(500).json({ statusCode: 500, codigo: 'ERROR_INTERNO', message: 'Error interno del servidor.' });
  }
}
