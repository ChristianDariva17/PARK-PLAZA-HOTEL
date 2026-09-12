import assert from 'node:assert/strict';
import test from 'node:test';
import { CUSTOMER_ROUTES, customerContractMatrix, isCustomerContractAdmitted } from './contractAdmission.js';

test('every mounted customer route has an explicit contract state', () => {
  assert.deepEqual(Object.keys(customerContractMatrix).sort(), [...CUSTOMER_ROUTES].sort());
  for (const route of CUSTOMER_ROUTES) {
    assert.equal(isCustomerContractAdmitted(route), true);
  }
});

test('does not advertise a customer home endpoint that the backend does not expose', () => {
  assert.equal(customerContractMatrix['/'].endpoint, 'derived:public-experience');
  assert.equal(customerContractMatrix['/'].session, 'public');
  assert.equal(customerContractMatrix['/'].permission, 'public-catalog');
});
