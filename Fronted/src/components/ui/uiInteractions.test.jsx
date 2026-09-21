/** @vitest-environment jsdom */

import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react/pure';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormField } from './FormField';
import { FormWizard } from './FormWizard';
import { Dialog, Drawer, TabPanel, Tabs } from './Overlay';

let appRoot;

beforeEach(() => {
  appRoot = document.createElement('div');
  appRoot.id = 'root';
  document.body.appendChild(appRoot);
});

afterEach(() => {
  cleanup();
  appRoot?.remove();
  appRoot = null;
});

function OverlayHarness({ Component, title }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir overlay</button>
      <Component open={open} onClose={() => setOpen(false)} title={title} description="Descripción accesible">
        <button type="button">Acción interna</button>
      </Component>
    </>
  );
}

function TabsHarness() {
  const [activeTab, setActiveTab] = useState('first');

  return (
    <>
      <Tabs
        label="Secciones de prueba"
        tabs={[{ id: 'first', label: 'Primera' }, { id: 'second', label: 'Segunda' }]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />
      <TabPanel id="first" active={activeTab === 'first'} label="Contenido primero">
        Contenido primero
      </TabPanel>
      <TabPanel id="second" active={activeTab === 'second'} label="Contenido segundo">
        Contenido segundo
      </TabPanel>
    </>
  );
}

describe('shared UI interactions', () => {
  it('associates FormField controls with helper and error content', () => {
    render(
      <FormField label="Nombre" required helperText="Usá el nombre legal" error="El nombre es obligatorio">
        <input />
      </FormField>,
    );

    const control = screen.getByRole('textbox', { name: 'Nombre' });
    const describedBy = control.getAttribute('aria-describedby').split(' ');

    expect(control.id).not.toBe('');
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(describedBy).toContain(`${control.id}-helper`);
    expect(describedBy).toContain(`${control.id}-error`);
    expect(screen.getByText('Usá el nombre legal').id).toBe(`${control.id}-helper`);
    expect(screen.getByRole('alert').textContent).toBe('El nombre es obligatorio');
  });

  it('moves focus to a wizard validation error', async () => {
    const user = userEvent.setup();
    const validate = vi.fn(() => 'Completá los datos requeridos');

    render(
      <FormWizard
        steps={[{ label: 'Datos', title: 'Datos personales', content: <input aria-label="Dato" />, validate }]}
        summary={<p>Resumen</p>}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Continuar"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    const error = screen.getByRole('alert');
    expect(validate).toHaveBeenCalledOnce();
    expect(error.textContent).toBe('Completá los datos requeridos');
    expect(document.activeElement).toBe(error);
  });

  it.each([
    ['dialog', Dialog, 'Cerrar Diálogo'],
    ['drawer', Drawer, 'Cerrar Drawer'],
  ])('traps focus and restores it for a %s', async (_name, Component, closeLabel) => {
    const user = userEvent.setup();
    render(<OverlayHarness Component={Component} title={closeLabel.replace('Cerrar ', '')} />);

    const trigger = screen.getByRole('button', { name: 'Abrir overlay' });
    await user.click(trigger);

    const overlay = screen.getByRole('dialog');
    const closeButton = screen.getByRole('button', { name: closeLabel });
    expect(overlay).toBeTruthy();
    expect(document.activeElement).toBe(closeButton);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('moves between tabs with arrow keys and keeps panel linkage', async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);

    const firstTab = screen.getByRole('tab', { name: 'Primera' });
    const secondTab = screen.getByRole('tab', { name: 'Segunda' });
    firstTab.focus();
    await user.keyboard('[ArrowRight]');

    const panel = screen.getByRole('tabpanel');
    expect(secondTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(secondTab);
    expect(panel.id).toBe(secondTab.getAttribute('aria-controls'));
    expect(panel.getAttribute('aria-labelledby')).toBe(secondTab.id);
  });
});
