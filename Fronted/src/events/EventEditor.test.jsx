/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react/pure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkSpaceAvailability: vi.fn(),
  createEvent: vi.fn(),
  getEventDetail: vi.fn(),
  getSpaces: vi.fn(),
  updateEvent: vi.fn(),
}));

const useHotel = vi.hoisted(() => vi.fn());

vi.mock('./eventsClient', () => ({ eventsClient: mocks }));
vi.mock('../state/hotelContext.js', () => ({ useHotel }));

import { EventEditor } from './EventEditor.jsx';

const space = {
  id: 'space-1',
  name: 'Salón A',
  capacity: 50,
  baseRate: '500.00',
};

beforeEach(() => {
  vi.clearAllMocks();
  useHotel.mockReturnValue({
    state: {
      guests: [{ id: 'guest-1', firstName: 'Ana', lastName: 'Pérez', documentNumber: '70889901' }],
      stays: [],
    },
  });
  mocks.getSpaces.mockResolvedValue([space]);
  mocks.checkSpaceAvailability.mockResolvedValue({ isAvailable: true });
  mocks.createEvent.mockResolvedValue({ id: 'event-1', version: 1 });
});

afterEach(cleanup);

describe('EventEditor', () => {
  it('creates an event with normalized dates, identity, and services payload', async () => {
    const onSaved = vi.fn();

    render(<EventEditor onSaved={onSaved} onCancel={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getAllByRole('combobox').some((control) => control.value === 'space-1')).toBe(true),
    );
    fireEvent.change(screen.getByPlaceholderText('Ej: Banquete Anual Grupo Gloria, Boda Civil...'), {
      target: { value: 'Board meeting' },
    });
    fireEvent.submit(document.querySelector('form.event-editor-form'));

    await waitFor(() => expect(mocks.createEvent).toHaveBeenCalledOnce());
    const [payload] = mocks.createEvent.mock.calls[0];

    expect(payload).toMatchObject({
      title: 'Board meeting',
      spaceId: 'space-1',
      guestId: 'guest-1',
      attendees: 20,
      estimatedAmount: 1500,
      services: [],
    });
    expect(payload.startsAt).toMatch(/T/);
    expect(payload.endsAt).toMatch(/T/);
    expect(onSaved).toHaveBeenCalledOnce();
  });
});
