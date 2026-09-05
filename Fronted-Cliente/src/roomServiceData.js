export async function loadRoomServiceData(customer, loadMenu, loadOrders, loadActiveStays) {
  const [menuResult, ordersResult, staysResult] = await Promise.allSettled([
    loadMenu(),
    customer ? loadOrders() : Promise.resolve([]),
    customer ? loadActiveStays() : Promise.resolve({ stays: [] }),
  ]);
  return {
    menu: menuResult.status === 'fulfilled' ? menuResult.value : [],
    menuError: menuResult.status === 'rejected' ? menuResult.reason : null,
    orders: ordersResult.status === 'fulfilled' ? ordersResult.value : [],
    ordersError: ordersResult.status === 'rejected' ? ordersResult.reason : null,
    stays: staysResult.status === 'fulfilled' ? staysResult.value.stays : [],
    staysError: staysResult.status === 'rejected' ? staysResult.reason : null,
  };
}

export function retainSelectedStay(stays, selectedStayId) {
  return stays.some((stay) => stay.id === selectedStayId) ? selectedStayId : '';
}

export function formatRoomServiceError(error, fallback) {
  if (typeof error?.details?.message === 'string' && error.details.message.trim()) {
    return error.details.message.trim();
  }
  const code = typeof error?.details?.code === 'string' ? error.details.code.trim() : '';
  if (code) {
    if (code === 'STAY_ID_REQUIRED' || code === 'TARGET_ACCOUNT_REQUIRED') return 'Debe seleccionar una estadía de habitación o reserva de zona activa.';
    if (code === 'AMENITY_RESERVATION_UNAUTHORIZED') return 'No se encontró la reserva de zona o no está activa.';
    if (code === 'ACTIVE_STAY_UNAUTHORIZED') return 'No se encontró la estadía activa.';
    if (code === 'PAYMENT_MODE_UNSUPPORTED') return 'Método de pago no admitido para esta orden.';
    return `Código de error: ${code}`;
  }

  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  if (message && message !== 'Http Exception') return message;
  return fallback;
}

export function createCheckoutSubmitter() {
  let inFlight = false;
  return {
    run(task) {
      if (inFlight) return Promise.resolve(false);
      inFlight = true;
      return Promise.resolve().then(task).then(() => true).finally(() => { inFlight = false; });
    },
  };
}

export function startRoomServicePolling(loadOrders, onOrders, timers = globalThis) {
  const interval = timers.setInterval(async () => {
    try {
      onOrders(await loadOrders());
    } catch (error) {
      console.warn('Failed to poll orders', error);
    }
  }, 10000);
  return () => timers.clearInterval(interval);
}
