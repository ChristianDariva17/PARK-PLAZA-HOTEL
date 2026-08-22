export interface PostgresErrorFields {
  code: string;
  constraint?: string;
}

export function getPostgresErrorFields(error: unknown): PostgresErrorFields | null {
  if (typeof error !== 'object' || error === null || !('code' in error) || typeof error.code !== 'string') {
    return null;
  }

  if ('constraint' in error && typeof error.constraint === 'string') {
    return { code: error.code, constraint: error.constraint };
  }

  return { code: error.code };
}
