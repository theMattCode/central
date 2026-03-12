/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Navigation } from '@/components/Navigation/Navigation';

describe('Navigation', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps the logo visible while toggling desktop navigation width state', () => {
    render(<Navigation />);

    const collapseButton = screen.getByLabelText('Collapse navigation');
    const desktopNavigation = collapseButton.closest('aside');

    expect(desktopNavigation).toBeDefined();
    expect(desktopNavigation?.className).toContain('w-72');
    expect(screen.getAllByLabelText('Central logo').length).toBeGreaterThan(0);

    fireEvent.click(collapseButton);

    expect(screen.getByLabelText('Expand navigation')).toBeDefined();
    expect(desktopNavigation?.className).toContain('w-20');
    expect(screen.getAllByLabelText('Central logo').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText('Expand navigation'));

    expect(screen.getByLabelText('Collapse navigation')).toBeDefined();
    expect(desktopNavigation?.className).toContain('w-72');
  });

  it('opens and closes the mobile drawer', () => {
    render(<Navigation />);

    expect(screen.queryByLabelText('Close mobile navigation')).toBeNull();

    fireEvent.click(screen.getByLabelText('Open mobile navigation'));
    expect(screen.getByLabelText('Close mobile navigation')).toBeDefined();

    fireEvent.click(screen.getByLabelText('Close mobile navigation'));
    expect(screen.queryByLabelText('Close mobile navigation')).toBeNull();
  });
});
