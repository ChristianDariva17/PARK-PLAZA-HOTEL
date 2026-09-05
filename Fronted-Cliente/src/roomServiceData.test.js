import assert from 'node:assert/strict';
import test from 'node:test';
import { createCheckoutSubmitter, formatRoomServiceError, loadRoomServiceData, retainSelectedStay, startRoomServicePolling } from './roomServiceData.js';

test('keeps a loaded menu when customer order history fails', async () => {
  const menu = [{ id: 'product-id', name: 'Club sandwich' }];
  const historyError = new Error('Order history unavailable');

  const result = await loadRoomServiceData(
    { customerAccountId: 'customer-id' },
    async () => menu,
    async () => { throw historyError; },
    async () => ({ stays: [] }),
  );

  assert.deepEqual(result.menu, menu);
  assert.deepEqual(result.orders, []);
  assert.equal(result.ordersError, historyError);
});

test('keeps independent menu and active-stay results when another loader fails', async () => {
  const result = await loadRoomServiceData(
    { customerAccountId: 'customer-id' },
    async () => [{ id: 'menu-id' }],
    async () => [],
    async () => { throw new Error('Stay endpoint unavailable'); },
  );
  assert.deepEqual(result.menu, [{ id: 'menu-id' }]);
  assert.deepEqual(result.stays, []);
  assert.equal(result.staysError.message, 'Stay endpoint unavailable');
});

test('returns every authorized stay without imposing a checkout selection', async () => {
  const stays = [{ id: 'stay-a', roomNumber: '101' }, { id: 'stay-b', roomNumber: '102' }];
  const result = await loadRoomServiceData(
    { customerAccountId: 'customer-id' },
    async () => [],
    async () => [],
    async () => ({ stays }),
  );

  assert.deepEqual(result.stays, stays);
  assert.equal(retainSelectedStay(result.stays, ''), '');
  assert.equal(retainSelectedStay(result.stays, 'stay-a'), 'stay-a');
  assert.equal(retainSelectedStay(result.stays, 'former-stay'), '');
});

test('preserves typed portal error codes and falls back for generic errors', () => {
  assert.equal(
    formatRoomServiceError(
      { message: 'The request could not be completed.', details: { code: 'CUSTOMER_CANCELLATION_INELIGIBLE' } },
      'Error al cancelar el pedido.',
    ),
    'Código: CUSTOMER_CANCELLATION_INELIGIBLE',
  );
  assert.equal(formatRoomServiceError(new Error('Network unavailable'), 'Error al cancelar el pedido.'), 'Network unavailable');
  assert.equal(formatRoomServiceError(null, 'Error al cancelar el pedido.'), 'Error al cancelar el pedido.');
});

test('prevents a rapid second checkout activation from sending another request', async () => {
  const submitter = createCheckoutSubmitter();
  let requestCount = 0;
  let resolveFirst;
  const first = submitter.run(() => {
    requestCount += 1;
    return new Promise((resolve) => { resolveFirst = resolve; });
  });
  const second = await submitter.run(() => { requestCount += 1; });
  await Promise.resolve();

  assert.equal(second, false);
  assert.equal(requestCount, 1);
  resolveFirst();
  assert.equal(await first, true);
});

test('cleans up the active room-service polling interval', () => {
  const cleared = [];
  const interval = { id: 'orders-poll' };
  const cleanup = startRoomServicePolling(async () => [], () => {}, {
    setInterval: () => interval,
    clearInterval: (value) => cleared.push(value),
  });

  cleanup();
  assert.deepEqual(cleared, [interval]);
});
