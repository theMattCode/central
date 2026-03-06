/* @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Navigation } from '@/components/Navigation/Navigation';

describe('Navigation', () => {
  it('keeps the logo visible and toggles desktop brand copy with drawer state', () => {
    render(<Navigation />);

    expect(screen.getAllByLabelText('Central logo').length).toBeGreaterThan(0);
    expect(screen.getByText('Central')).toBeDefined();
    expect(screen.getByText('Dashboard')).toBeDefined();

    fireEvent.click(screen.getByLabelText('Collapse navigation'));

    expect(screen.queryByText('Central')).toBeNull();
    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.getAllByLabelText('Central logo').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText('Expand navigation'));

    expect(screen.getByText('Central')).toBeDefined();
    expect(screen.getByText('Dashboard')).toBeDefined();
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
