/** @vitest-environment jsdom */

import { act, cleanup, render, screen, waitFor } from '@testing-library/react/pure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  changePasswordRequest: vi.fn(),
  getInitialSession: vi.fn(),
  getSession: vi.fn(),
  googleLoginRequest: vi.fn(),
  loginRequest: vi.fn(),
  logoutRequest: vi.fn(),
  resetInitialSession: vi.fn(),
  subscribeUnauthorized: vi.fn(),
  disconnectSocket: vi.fn(),
}));

vi.mock('./authClient.js', () => mocks);
vi.mock('../realtime/socketClient.js', () => ({ disconnectSocket: mocks.disconnectSocket }));

import { AuthStateContext } from './authContext.js';
import { AuthProvider } from './AuthContext.jsx';

function AuthStateProbe() {
  return (
    <AuthStateContext.Consumer>
      {(auth) => (
        <output data-testid="auth-state" data-account={auth.account?.email || ''}>
          {auth.status}
        </output>
      )}
    </AuthStateContext.Consumer>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AuthProvider', () => {
  let notifyUnauthorized;

  beforeEach(() => {
    notifyUnauthorized = null;
    mocks.getInitialSession.mockResolvedValue({
      account: { id: 'account-1', email: 'admin@example.test' },
      permissions: ['dashboard.read'],
    });
    mocks.subscribeUnauthorized.mockImplementation((listener) => {
      notifyUnauthorized = listener;
      return () => {};
    });
  });

  it('bootstraps the session and clears it after an unauthorized response', async () => {
    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('auth-state').textContent).toBe('authenticated'));
    expect(screen.getByTestId('auth-state').getAttribute('data-account')).toBe('admin@example.test');

    act(() => notifyUnauthorized());

    expect(screen.getByTestId('auth-state').textContent).toBe('anonymous');
    expect(mocks.disconnectSocket).toHaveBeenCalledOnce();
    expect(mocks.resetInitialSession).toHaveBeenCalledOnce();
  });
});
