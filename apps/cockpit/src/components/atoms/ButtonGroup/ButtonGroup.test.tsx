/* @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ButtonGroup } from './ButtonGroup.tsx';

const options = [
  { id: '1', text: 'Option 1', colorVar: '--color-pri' },
  { id: '2', text: 'Option 2', colorVar: '--color-sec' },
];

describe('ButtonGroup', () => {
  const user = userEvent.setup();

  it('renders all options', () => {
    render(<ButtonGroup options={options} defaultValue={options[0]} onChanged={() => {}} />);

    expect(screen.getByText('Option 1')).toBeDefined();
    expect(screen.getByText('Option 2')).toBeDefined();
  });

  it('calls onChanged when an option is clicked', async () => {
    const onChanged = vi.fn();
    render(<ButtonGroup options={options} defaultValue={options[0]} onChanged={onChanged} />);

    await user.click(screen.getByText('Option 2'));

    expect(onChanged).toHaveBeenCalledWith(options[1]);
  });

  it('updates selected state internally', async () => {
    render(<ButtonGroup options={options} defaultValue={options[0]} onChanged={() => {}} />);

    const opt1 = screen.getByText('Option 1');
    const opt2 = screen.getByText('Option 2');

    // Check initial state (Option 1 selected)
    expect(opt1.getAttribute('aria-checked')).toBe('true');
    expect(opt2.getAttribute('aria-checked')).toBe('false');

    await user.click(opt2);

    expect(opt1.getAttribute('aria-checked')).toBe('false');
    expect(opt2.getAttribute('aria-checked')).toBe('true');
  });
});
