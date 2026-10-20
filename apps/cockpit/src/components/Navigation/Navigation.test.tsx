/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { flush } from 'solid-js';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/solid-router';
import { Navigation } from '@/components/Navigation/Navigation.tsx';

async function renderNavigation() {
  const router = createRouter({
    routeTree: createRootRoute({ component: Navigation }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(() => <RouterProvider router={router} />);
  await screen.findByLabelText('Collapse navigation');
  return router;
}

describe('Navigation', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps the logo visible while toggling desktop navigation width state', async () => {
    await renderNavigation();

    const collapseButton = screen.getByLabelText('Collapse navigation');
    const desktopNavigation = collapseButton.closest('aside');

    expect(desktopNavigation).toBeDefined();
    expect(desktopNavigation?.className).toContain('w-64');
    expect(screen.getAllByLabelText('Central logo').length).toBeGreaterThan(0);

    fireEvent.click(collapseButton);
    flush();

    expect(screen.getByLabelText('Expand navigation')).toBeDefined();
    expect(desktopNavigation?.className).toContain('w-16');
    expect(screen.getAllByLabelText('Central logo').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText('Expand navigation'));
    flush();

    expect(screen.getByLabelText('Collapse navigation')).toBeDefined();
    expect(desktopNavigation?.className).toContain('w-64');
  });

  it('opens and closes the mobile drawer', async () => {
    await renderNavigation();

    expect(screen.queryByLabelText('Close mobile navigation')).toBeNull();

    fireEvent.click(screen.getByLabelText('Open mobile navigation'));
    flush();
    expect(screen.getByLabelText('Close mobile navigation')).toBeDefined();

    fireEvent.click(screen.getByLabelText('Close mobile navigation'));
    flush();
    expect(screen.queryByLabelText('Close mobile navigation')).toBeNull();
  });

  it('renders primary route links', async () => {
    await renderNavigation();

    const linkLabels = screen.getAllByRole('link').map((link) => ({
      href: link.getAttribute('href'),
      label: link.textContent?.trim(),
    }));

    expect(linkLabels).toEqual([
      { href: '/', label: 'Overview' },
      { href: '/jarvis', label: 'Jarvis' },
      { href: '/finance/transactions', label: 'Transactions' },
      { href: '/finance/accounts', label: 'Accounts' },
    ]);
  });

  it('navigates client-side without reloading the document', async () => {
    const router = await renderNavigation();

    const [jarvisLink] = screen.getAllByRole('link', { name: 'Jarvis' });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    jarvisLink.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/jarvis'));
  });

  it('applies the item styling to router links', async () => {
    await renderNavigation();

    const [jarvisLink] = screen.getAllByRole('link', { name: 'Jarvis' });

    expect(jarvisLink.classList).toContain('gap-2');
    expect(jarvisLink.classList).toContain('glass-item');
  });

  it('marks only the link of the current route as active', async () => {
    await renderNavigation();

    const [overviewLink] = screen.getAllByRole('link', { name: 'Overview' });
    const [jarvisLink] = screen.getAllByRole('link', { name: 'Jarvis' });

    expect(overviewLink.getAttribute('aria-current')).toBe('page');
    expect(jarvisLink.getAttribute('aria-current')).toBeNull();
  });
});
