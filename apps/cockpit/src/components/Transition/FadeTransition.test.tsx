/* @vitest-environment jsdom */

import { createSignal, flush } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { FadeTransition } from '@/components/Transition/FadeTransition.tsx';

describe('FadeTransition', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates children immediately when the transition key stays unchanged', () => {
    const [content, setContent] = createSignal('Initial');
    render(() => <FadeTransition transitionKey="same">{() => <span>{content()}</span>}</FadeTransition>);

    setContent('Updated');
    flush();

    expect(screen.queryByText('Initial')).toBeNull();
    expect(screen.getByText('Updated')).toBeDefined();
  });

  it('fades out old content and fades in new content on key changes', () => {
    vi.useFakeTimers();
    const [transitionKey, setTransitionKey] = createSignal('first');

    const { container } = render(() => (
      <FadeTransition transitionKey={transitionKey()} durationMs={100}>
        {(visibleKey) => <span>{visibleKey === 'first' ? 'First' : 'Second'}</span>}
      </FadeTransition>
    ));

    setTransitionKey('second');
    flush();

    expect(screen.getByText('First')).toBeDefined();
    expect(screen.queryByText('Second')).toBeNull();
    expect(container.firstElementChild?.className).toContain('opacity-0');

    vi.advanceTimersByTime(100);
    flush();

    expect(screen.queryByText('First')).toBeNull();
    expect(screen.getByText('Second')).toBeDefined();
    expect(container.firstElementChild?.className).toContain('opacity-0');

    vi.advanceTimersByTime(16);
    flush();

    expect(container.firstElementChild?.className).toContain('opacity-100');
  });
});
