import { describe, expect, it } from 'vitest';
import { buildCashMovementDto, buildCountCashSessionDto, buildOpenCashSessionDto, CASH_PAYMENT_METHODS } from './cashModel.js';

describe('cash request DTO mapping', () => {
  it('maps the exact open-session contract including responsible', () => {
    expect(buildOpenCashSessionDto({ openingAmount: '125.5', responsible: ' Ana ', shift: 'Mañana', notes: ' Inicio ' })).toEqual({
      openingAmount: 125.5,
      responsible: 'Ana',
      shift: 'Mañana',
      notes: 'Inicio',
    });
  });

  it('uses countedAmount and singular note for count and close requests', () => {
    expect(buildCountCashSessionDto({ countedAmount: '210', note: ' Arqueo ' })).toEqual({ countedAmount: 210, note: 'Arqueo' });
    expect(buildCountCashSessionDto({ countedAmount: 210, note: ' ' })).toEqual({ countedAmount: 210 });
  });

  it('maps movements without session or unsupported notes aliases', () => {
    expect(buildCashMovementDto({ type: 'Ingreso', concept: ' Pago ', referenceId: ' OP-1 ', amount: '50.25', method: 'Efectivo', notes: 'ignored' })).toEqual({
      type: 'Ingreso',
      concept: 'Pago',
      referenceId: 'OP-1',
      amount: 50.25,
      method: 'Efectivo',
    });
    expect(CASH_PAYMENT_METHODS).toEqual(['Efectivo', 'Tarjeta', 'Transferencia', 'Yape', 'Plin']);
  });
});
