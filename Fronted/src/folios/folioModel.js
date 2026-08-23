export const PAYMENT_METHODS = Object.freeze(['Efectivo', 'Tarjeta', 'Transferencia', 'Yape', 'Plin']);

export function validateFolioAmount(value) {
  const amount = String(value ?? '');
  if (!/^\d+\.\d{2}$/.test(amount) || Number(amount) <= 0) throw new Error('Amount must be a positive two-decimal value.');
  return amount;
}

export function canOverrideCheckout(permissions, folio) {
  return Number(folio?.balance ?? 0) > 0 && permissions?.includes('stays.check_out') && permissions?.includes('stays.check_out_override');
}

export function folioBalanceLabel(balance) { return Number(balance).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' }); }

export function canReverseEntry(entry, entries = []) {
  return Boolean(entry?.id) && entry.type !== 'reversal' && !entries.some((candidate) => candidate.reversalOfEntryId === entry.id);
}

export function checkoutDebtMessage(folio) {
  return Number(folio?.balance ?? 0) > 0 ? `Saldo pendiente: ${folioBalanceLabel(folio.balance)}.` : '';
}
