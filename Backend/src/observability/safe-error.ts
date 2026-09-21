type ErrorWithCode = { code?: unknown };

export function safeErrorFields(error: unknown): { errorType: string; errorCode?: string } {
  const errorType = error instanceof Error ? error.name || 'Error' : typeof error;
  const candidate = typeof error === 'object' && error !== null
    ? (error as ErrorWithCode).code
    : undefined;

  return {
    errorType,
    ...(typeof candidate === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(candidate)
      ? { errorCode: candidate }
      : {}),
  };
}
