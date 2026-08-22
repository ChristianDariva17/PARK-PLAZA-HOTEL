import { sql, type SQL } from 'drizzle-orm';

export interface TransactionLockExecutor {
  execute(query: SQL): PromiseLike<unknown>;
}

type LockNamespace = 'property' | 'account';

const LOCK_HASH_SEED = 0;

async function acquireTransactionLock(
  transaction: TransactionLockExecutor,
  namespace: LockNamespace,
  key: string,
): Promise<void> {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${namespace}:${key}`}, ${LOCK_HASH_SEED}))`,
  );
}

export function acquirePropertyTransactionLock(
  transaction: TransactionLockExecutor,
  propertyId: string,
): Promise<void> {
  return acquireTransactionLock(transaction, 'property', propertyId);
}

export function acquireAccountTransactionLock(
  transaction: TransactionLockExecutor,
  accountId: string,
): Promise<void> {
  return acquireTransactionLock(transaction, 'account', accountId);
}

/** Global lock order: property before account whenever a transaction needs both. */
export async function acquirePropertyThenAccountTransactionLocks(
  transaction: TransactionLockExecutor,
  propertyId: string,
  accountId: string,
): Promise<void> {
  await acquirePropertyTransactionLock(transaction, propertyId);
  await acquireAccountTransactionLock(transaction, accountId);
}
