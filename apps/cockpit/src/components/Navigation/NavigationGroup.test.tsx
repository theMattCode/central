/* @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NavigationGroup } from '@/components/Navigation/NavigationGroup';

describe('NavigationGroup', () => {
  it('renders a divider after the title', () => {
    render(
      <NavigationGroup title="Finance">
        <a href="/invest">Invest</a>
      </NavigationGroup>,
    );

    expect(screen.getByText('Finance')).toBeDefined();
    const divider = screen.getByTestId('navigation-group-divider');
    const toggleIcon = screen.getByTestId('navigation-group-toggle-icon');

    expect(divider).toBeDefined();
    expect(toggleIcon).toBeDefined();
    expect(divider.nextElementSibling).toBe(toggleIcon);
  });

  it('is expandable and collapsible with native details state', () => {
    const { container } = render(
      <NavigationGroup title="Finance">
        <a href="/invest">Invest</a>
      </NavigationGroup>,
    );

    const details = container.querySelector('details');
    const summary = container.querySelector('summary');

    expect(details).toBeInstanceOf(HTMLDetailsElement);
    expect(summary).toBeInstanceOf(HTMLElement);
    expect((details as HTMLDetailsElement).open).toBe(true);

    fireEvent.click(summary as HTMLElement);

    expect((details as HTMLDetailsElement).open).toBe(false);
  });
});
