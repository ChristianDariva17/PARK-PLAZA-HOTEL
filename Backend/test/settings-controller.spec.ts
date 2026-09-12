import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';
import { SettingsController } from '../src/settings/settings.controller.js';
import type { SettingsService } from '../src/settings/settings.service.js';

const actor = {
  accountId: 'account-id',
  propertyId: 'property-id',
  roleKey: 'administrator',
  email: 'admin@example.com',
  permissions: ['settings.read', 'settings.manage'],
  sessionId: 'session-id',
  passwordChangeRequired: false,
} satisfies AuthenticatedAccount;

describe('SettingsController', () => {
  it('forwards reads using the authenticated property', async () => {
    const service = { getSettings: vi.fn().mockResolvedValue({ id: actor.propertyId }) } as unknown as SettingsService;
    await new SettingsController(service).getSettings(actor);
    expect(service.getSettings).toHaveBeenCalledWith(actor.propertyId);
  });

  it('validates and forwards updates with request context', async () => {
    const service = { updateSettings: vi.fn().mockResolvedValue({ id: actor.propertyId }) } as unknown as SettingsService;
    const request = { id: 'request-id', ip: '127.0.0.1', headers: { 'user-agent': 'test-agent' } };
    const body = { currency: 'PEN', reservationIntervalMinutes: 30 };

    await new SettingsController(service).updateSettings(actor, request as never, body);

    expect(service.updateSettings).toHaveBeenCalledWith(actor, body, {
      requestId: 'request-id',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });
  });

  it('rejects unknown or invalid settings fields', async () => {
    const service = { updateSettings: vi.fn() } as unknown as SettingsService;
    const controller = new SettingsController(service);
    const request = { id: 'request-id', ip: '127.0.0.1', headers: {} };

    await expect(controller.updateSettings(actor, request as never, { unknown: true })).rejects.toThrow('Invalid settings update payload');
    await expect(controller.updateSettings(actor, request as never, { dayUseStart: '25:00' })).rejects.toThrow('Invalid settings update payload');
    expect(service.updateSettings).not.toHaveBeenCalled();
  });
});
