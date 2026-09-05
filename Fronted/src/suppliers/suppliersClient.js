import { authRequest } from '../auth/authClient.js';

export const generateIdempotencyKey = () => crypto.randomUUID();

export const suppliersClient = {
  async getSuppliers(params = {}, signal) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page);
    if (params.pageSize) searchParams.append('pageSize', params.pageSize);
    if (params.q) searchParams.append('q', params.q);
    if (params.status) searchParams.append('status', params.status);

    return authRequest(`/api/suppliers?${searchParams.toString()}`, { signal });
  },

  async getSupplierDetail(supplierId, signal) {
    return authRequest(`/api/suppliers/${supplierId}`, { signal });
  },

  async getSupplierInventory(supplierId, signal) {
    return authRequest(`/api/suppliers/${supplierId}/inventory`, { signal });
  },

  async assignSupplierInventory(supplierId, itemIds) {
    return authRequest(`/api/suppliers/${supplierId}/inventory/assign`, {
      method: 'POST',
      body: JSON.stringify({ itemIds }),
    });
  },

  async getReorderSuggestions(signal) {
    return authRequest('/api/suppliers/reorder-suggestions', { signal });
  },

  async getPurchaseOrders(params = {}, signal) {
    const searchParams = new URLSearchParams();
    if (params.supplierId) searchParams.append('supplierId', params.supplierId);
    if (params.status) searchParams.append('status', params.status);

    return authRequest(`/api/suppliers/purchase-orders?${searchParams.toString()}`, { signal });
  },

  async getPurchaseOrderDetail(orderId, signal) {
    return authRequest(`/api/suppliers/purchase-orders/${orderId}`, { signal });
  },

  async createPurchaseOrder(data) {
    return authRequest('/api/suppliers/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Idempotency-Key': generateIdempotencyKey(),
      },
    });
  },

  async sendPurchaseOrder(orderId) {
    return authRequest(`/api/suppliers/purchase-orders/${orderId}/send`, {
      method: 'POST',
    });
  },

  async receivePurchaseOrder(orderId, payload) {
    return authRequest(`/api/suppliers/purchase-orders/${orderId}/receive`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Idempotency-Key': generateIdempotencyKey(),
      },
    });
  },

  async rateSupplier(supplierId, ratingData) {
    return authRequest(`/api/suppliers/${supplierId}/rate`, {
      method: 'POST',
      body: JSON.stringify(ratingData),
    });
  },

  async restockFromSupplier(supplierId, payload) {
    return authRequest(`/api/suppliers/${supplierId}/restock`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Idempotency-Key': generateIdempotencyKey(),
      },
    });
  },

  async createSupplier(data) {
    return authRequest('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Idempotency-Key': generateIdempotencyKey(),
      },
    });
  },

  async updateSupplier(supplierId, expectedVersion, data) {
    return authRequest(`/api/suppliers/${supplierId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...data, expectedVersion }),
      headers: {
        'Idempotency-Key': generateIdempotencyKey(),
      },
    });
  },

  async archiveSupplier(supplierId, expectedVersion, reason) {
    return authRequest(`/api/suppliers/${supplierId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion, reason }),
      headers: {
        'Idempotency-Key': generateIdempotencyKey(),
      },
    });
  },

  async reactivateSupplier(supplierId, expectedVersion, reason) {
    return authRequest(`/api/suppliers/${supplierId}/reactivate`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion, reason }),
      headers: {
        'Idempotency-Key': generateIdempotencyKey(),
      },
    });
  }
};
