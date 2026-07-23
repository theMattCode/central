/* @vitest-environment jsdom */
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EditableText } from '@/components/EditableText/EditableText.tsx';

describe('EditableTextField', () => {
  it('renders display text outside edit mode', () => {
    render(<EditableText value="Main Checking" initialEditing={false} onChange={vi.fn()} />);

    expect(screen.getByText('Main Checking')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('focuses and reports changes in edit mode', async () => {
    const user = userEvent.setup();

    function TestField() {
      const [value, setValue] = useState('Main Checking');
      return <EditableText value={value} initialEditing autoFocus onChange={setValue} />;
    }

    render(<TestField />);

    const input = screen.getByRole('textbox');
    expect(document.activeElement).toBe(input);
    await user.type(input, ' Account');
    expect((input as HTMLInputElement).value).toBe('Main Checking Account');
  });
});
