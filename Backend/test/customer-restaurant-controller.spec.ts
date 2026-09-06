import { HttpException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC } from '../src/auth/decorators/public.decorator.js';
import type { Environment } from '../src/config/environment.js';
import type { CustomerAuthService } from '../src/customer/customer-auth.service.js';
import { CustomerRestaurantController } from '../src/customer/customer-restaurant.controller.js';
import { CustomerSessionGuard } from '../src/customer/customer-session.guard.js';
import type { RestaurantService } from '../src/restaurant/restaurant.service.js';

describe('CustomerRestaurantController authentication boundary', () => {
  it.each(['menu', 'orders', 'create', 'cancel'] as const)('marks %s public to the global staff session guard', (method) => {
    expect(Reflect.getMetadata(IS_PUBLIC, CustomerRestaurantController.prototype[method])).toBe(true);
  });

  it.each(['orders', 'create', 'cancel'] as const)('retains the customer session guard on %s', (method) => {
    expect(Reflect.getMetadata(GUARDS_METADATA, CustomerRestaurantController.prototype[method])).toContain(CustomerSessionGuard);
  });

  it('rejects customer order access without a customer session cookie', async () => {
    const sessions = { resolve: vi.fn() } as unknown as CustomerAuthService;
    const config = { get: vi.fn().mockReturnValue('pp_customer_session') } as unknown as ConfigService<Environment, true>;
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ cookies: {}, headers: {} }) }),
    } as unknown as ExecutionContext;

    await expect(new CustomerSessionGuard(sessions, config).canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.resolve).not.toHaveBeenCalled();
  });

  it('requires an explicit stay selection, including an ambiguous active-stay choice', () => {
    const restaurant = { createCustomerOrder: vi.fn() } as unknown as RestaurantService;
    const controller = new CustomerRestaurantController(restaurant, {} as ConfigService<Environment, true>);
    const request = { customer: { customerAccountId: 'customer', propertyId: 'property' } } as any;

    expect(() => controller.create({ deliveryMode: 'Room' }, '550e8400-e29b-41d4-a716-446655440002', request)).toThrow(HttpException);
    try {
      controller.create({ deliveryMode: 'Room' }, '550e8400-e29b-41d4-a716-446655440002', request);
    } catch (error) {
      expect(error).toMatchObject({ status: 400, response: { version: 1, outcome: 'rejected', code: 'TARGET_ACCOUNT_REQUIRED' } });
    }
    expect(restaurant.createCustomerOrder).not.toHaveBeenCalled();
  });
});
