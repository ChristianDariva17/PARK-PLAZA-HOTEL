import { HttpException, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from '../src/http/http-exception.filter.js';

function httpContext(requestId: string) {
  const send = vi.fn();
  const status = vi.fn().mockReturnValue({ send });
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ id: requestId }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;

  return { host, send, status };
}

describe('HttpExceptionFilter', () => {
  it('preserves an HttpException string message', () => {
    const { host, send, status } = httpContext('request-string');

    new HttpExceptionFilter().catch(new HttpException('Resource conflict', 409), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(send).toHaveBeenCalledWith({
      statusCode: 409,
      error: 'Conflict',
      message: 'Resource conflict',
      requestId: 'request-string',
    });
  });

  it('normalizes a structured message array into a stable string', () => {
    const { host, send } = httpContext('request-validation');
    const exception = new HttpException({
      statusCode: 400,
      error: 'Bad Request',
      message: ['email must be valid', 'password is required'],
    }, 400);

    new HttpExceptionFilter().catch(exception, host);

    expect(send).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'Bad Request',
      message: 'email must be valid; password is required',
      requestId: 'request-validation',
    });
  });

  it('hides unexpected error details and logs only sanitized diagnostics', () => {
    const { host, send, status } = httpContext('request-500');
    const logger = { error: vi.fn() };

    new HttpExceptionFilter(logger).catch(new Error('password=secret SQL select * from accounts'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(send).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
      requestId: 'request-500',
    });
    expect(logger.error).toHaveBeenCalledWith({ requestId: 'request-500', exceptionType: 'Error' });
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('secret');
    expect(JSON.stringify(send.mock.calls)).not.toContain('select *');
  });

  it('copies the Fastify request ID exactly', () => {
    const requestId = 'req-01HZX/exact:value';
    const { host, send } = httpContext(requestId);

    new HttpExceptionFilter().catch(new HttpException({ error: 'Teapot', message: 'Short and stout' }, 418), host);

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ requestId }));
  });
});
