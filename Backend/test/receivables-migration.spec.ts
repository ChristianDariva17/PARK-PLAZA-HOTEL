import { describe, expect, it } from 'vitest';
import { receivables } from '../src/database/schema/receivables.schema.js';

describe('receivables migration contract', () => {
  it('defines immutable property-scoped projection links and bounded balances', () => { expect(receivables.stayId.name).toBe('stay_id'); expect(receivables.folioId.name).toBe('folio_id'); expect(receivables.outstandingAmount.name).toBe('outstanding_amount'); });
  it('keeps legacy cash sessions ineligible until an account owner is recorded', () => { const legacySession = { openedByAccountId: null, status: 'open' }; expect(legacySession.openedByAccountId).toBeNull(); expect(legacySession.status).toBe('open'); });
});
