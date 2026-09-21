import { ArgumentsHost, Catch, HttpException, Logger, type ExceptionFilter } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { FastifyReply, FastifyRequest } from 'fastify';

interface ErrorLogger {
  error(message: unknown): void;
}

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code: string;
  requestId: string;
  errors?: readonly { field: string; messages: readonly string[] }[];
  // Keep the old names during the documented compatibility window.
  statusCode: number;
  error: string;
  message: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: ErrorLogger = new Logger(HttpExceptionFilter.name)) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const reply = context.getResponse<FastifyReply>();
    const requestId = String(request.id ?? 'unknown');
    const envelope = exception instanceof HttpException
      ? this.fromHttpException(exception, requestId, request.url)
      : this.fromUnexpectedException(requestId, request.url);

    if (envelope.statusCode >= 500) {
      this.logger.error({
        requestId: request.id,
        exceptionType: exception instanceof Error ? exception.constructor.name : typeof exception,
      });
    }

    reply.header('X-Request-Id', requestId);
    reply.header('Content-Type', 'application/problem+json');
    reply.status(envelope.statusCode).send(envelope);
  }

  private fromHttpException(exception: HttpException, requestId: string, requestUrl?: string): ProblemDetails {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();
    const payload = typeof response === 'object' && response !== null
      ? response as Record<string, unknown>
      : undefined;
    const responseMessage = payload?.detail ?? payload?.message;
    const detail = detailFrom(responseMessage ?? (typeof response === 'string' ? response : exception.message));
    const title = typeof payload?.title === 'string'
      ? payload.title
      : typeof payload?.error === 'string'
        ? payload.error
        : STATUS_CODES[statusCode] ?? 'Error';
    const code = problemCode(payload?.code, detail, statusCode);

    return {
      type: `urn:park-plaza:problem:${code.toLowerCase()}`,
      title,
      status: statusCode,
      detail,
      ...(requestUrl ? { instance: requestUrl.split('?')[0] } : {}),
      code,
      requestId,
      ...validationErrors(responseMessage),
      statusCode,
      error: title,
      message: detail,
    };
  }

  private fromUnexpectedException(requestId: string, requestUrl?: string): ProblemDetails {
    const detail = 'Internal server error';
    const title = 'Internal Server Error';
    const code = 'INTERNAL_SERVER_ERROR';
    return {
      type: 'urn:park-plaza:problem:internal_server_error',
      title,
      status: 500,
      detail,
      ...(requestUrl ? { instance: requestUrl.split('?')[0] } : {}),
      code,
      requestId,
      statusCode: 500,
      error: title,
      message: detail,
    };
  }
}

function detailFrom(value: unknown): string {
  const values = Array.isArray(value) ? value : [value];
  const detail = values.map((item) => {
    if (typeof item === 'string') return item;
    if (typeof item === 'object' && item !== null) {
      const record = item as Record<string, unknown>;
      const messages = record.constraints && typeof record.constraints === 'object'
        ? Object.values(record.constraints).map(String).join(', ')
        : undefined;
      return messages || (typeof record.message === 'string' ? record.message : 'Invalid request');
    }
    return String(item);
  }).join('; ');
  return detail.slice(0, 1_000) || 'Request failed';
}

function problemCode(value: unknown, detail: string, statusCode: number): string {
  if (typeof value === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(value)) return value;
  const inferred = detail.trim();
  if (/^[A-Z][A-Z0-9_.-]{2,99}$/.test(inferred)) return inferred;
  return `HTTP_${statusCode}`;
}

function validationErrors(value: unknown): Pick<ProblemDetails, 'errors'> {
  if (!Array.isArray(value)) return {};
  const errors = value.flatMap((item) => {
    if (typeof item === 'string') return [{ field: '_global', messages: [item] }];
    if (typeof item !== 'object' || item === null) return [];
    const record = item as Record<string, unknown>;
    const field = typeof record.property === 'string' ? record.property : '_global';
    const messages = record.constraints && typeof record.constraints === 'object'
      ? Object.values(record.constraints).map(String)
      : typeof record.message === 'string' ? [record.message] : [];
    return messages.length ? [{ field, messages }] : [];
  });
  return errors.length ? { errors } : {};
}
