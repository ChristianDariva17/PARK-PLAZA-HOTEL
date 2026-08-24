import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { parseCollectionDto, parseListFilters, parseReversalDto } from '../src/receivables/receivables.dto.js';

describe('receivable DTO contracts', () => {
  it('accepts only positive two-decimal collections and supported methods', () => { expect(parseCollectionDto({ amount: '12.50', method: 'Tarjeta', reference: 'REF-1' })).toEqual({ amount: '12.50', method: 'Tarjeta', reference: 'REF-1' }); });
  it('rejects malformed amounts, unknown fields, repeated filter values, and blank reversals', () => { expect(() => parseCollectionDto({ amount: '12.5', method: 'Tarjeta' })).toThrow(BadRequestException); expect(() => parseCollectionDto({ amount: '1.00', method: 'Cheque' })).toThrow(BadRequestException); expect(() => parseListFilters({ status: ['open', 'settled'] })).toThrow(BadRequestException); expect(() => parseReversalDto({ reason: '   ' })).toThrow(BadRequestException); });
  it('scenario: Explicit non-goals reject unsupported payment processing contracts', () => { expect(() => parseCollectionDto({ amount: '1.00', method: 'Crypto', deposit: true })).toThrow(BadRequestException); });
});
