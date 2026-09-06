import { ArgumentsHost, Catch, HttpException, Logger, type ExceptionFilter } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { FastifyReply, FastifyRequest } from 'fastify';

interface ErrorLogger {
  error(message: unknown): void;
}

interface ErrorEnvelope {
  statusCode: number;
  error: string;
  message: string;
  requestId: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: ErrorLogger = new Logger(HttpExceptionFilter.name)) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const reply = context.getResponse<FastifyReply>();
    const envelope = exception instanceof HttpException
      ? this.fromHttpException(exception, request.id)
      : this.fromUnexpectedException(request.id);

    if (envelope.statusCode >= 500) {
      this.logger.error({
        requestId: request.id,
        exceptionType: exception instanceof Error ? exception.constructor.name : typeof exception,
      });
    }

    reply.status(envelope.statusCode).send(envelope);
  }

  private fromHttpException(exception: HttpException, requestId: string): ErrorEnvelope {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();
    const payload = typeof response === 'object' && response !== null
      ? response as Record<string, unknown>
      : undefined;
    const responseMessage = payload?.message;
    const message = Array.isArray(responseMessage)
      ? responseMessage.map(String).join('; ')
      : typeof responseMessage === 'string'
        ? responseMessage
        : typeof response === 'string'
          ? response
          : exception.message;

    return {
      statusCode,
      error: typeof payload?.error === 'string' ? payload.error : STATUS_CODES[statusCode] ?? 'Error',
      message,
      requestId,
    };
  }

  private fromUnexpectedException(requestId: string): ErrorEnvelope {
    return {
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
      requestId,
    };
  }
}
