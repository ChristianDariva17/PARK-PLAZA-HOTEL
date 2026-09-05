import assert from 'node:assert/strict';
import test from 'node:test';
import { CUSTOMER_ROUTES, customerContractMatrix, isCustomerContractAdmitted } from './contractAdmission.js';

test('every mounted customer route has an explicit contract state', () => {
  assert.deepEqual(Object.keys(customerContractMatrix).sort(), [...CUSTOMER_ROUTES].sort());
  for (const route of CUSTOMER_ROUTES) {
    assert.equal(isCustomerContractAdmitted(route), true);
  }
});
