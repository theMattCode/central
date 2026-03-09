/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { FadeTransition } from '@/components/Transition/FadeTransition';

describe('FadeTransition', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates children immediately when the transition key stays unchanged', () => {
    const { rerender } = render(
      <FadeTransition transitionKey="same">
        <span>Initial</span>
      </FadeTransition>,
    );

    rerender(
      <FadeTransition transitionKey="same">
        <span>Updated</span>
      </FadeTransition>,
    );

    expect(screen.queryByText('Initial')).toBeNull();
    expect(screen.getByText('Updated')).toBeDefined();
  });

  it('fades out old content and fades in new content on key changes', () => {
    vi.useFakeTimers();

    const { container, rerender } = render(
      <FadeTransition transitionKey="first" durationMs={100}>
        <span>First</span>
      </FadeTransition>,
    );

    rerender(
      <FadeTransition transitionKey="second" durationMs={100}>
        <span>Second</span>
      </FadeTransition>,
    );

    expect(screen.getByText('First')).toBeDefined();
    expect(screen.queryByText('Second')).toBeNull();
    expect(container.firstElementChild?.className).toContain('opacity-0');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.queryByText('First')).toBeNull();
    expect(screen.queryByText('Second')).not.toBeNull();
    expect(container.firstElementChild?.className).toContain('opacity-0');

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(container.firstElementChild?.className).toContain('opacity-100');
  });
});
