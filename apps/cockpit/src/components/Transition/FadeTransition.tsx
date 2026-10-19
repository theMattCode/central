import { createEffect, createSignal, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';

type TransitionKey = string | number;

type FadeTransitionProps = {
  children: (visibleKey: TransitionKey) => JSX.Element;
  transitionKey: TransitionKey;
  durationMs?: number;
  class?: string;
};

type FadePhase = 'entered' | 'exiting' | 'entering';

export function FadeTransition(props: FadeTransitionProps) {
  let currentVisibleKey = untrack(() => props.transitionKey);
  const [visibleKey, setVisibleKey] = createSignal<TransitionKey>(currentVisibleKey);
  const [phase, setPhase] = createSignal<FadePhase>('entered');

  createEffect(
    () => [props.transitionKey, props.durationMs ?? 300] as const,
    ([nextKey, durationMs]) => {
      if (nextKey === currentVisibleKey) return;

      let enterTimeout: ReturnType<typeof setTimeout> | undefined;
      setPhase('exiting');
      const exitTimeout = setTimeout(() => {
        currentVisibleKey = nextKey;
        setVisibleKey(nextKey);
        setPhase('entering');
        enterTimeout = setTimeout(() => setPhase('entered'), 16);
      }, durationMs);

      return () => {
        clearTimeout(exitTimeout);
        if (enterTimeout) clearTimeout(enterTimeout);
      };
    },
    { name: 'fadeTransition' },
  );

  return (
    <div
      class={[
        'w-full h-full',
        'transition-opacity',
        { 'opacity-100': phase() === 'entered', 'opacity-0': phase() !== 'entered' },
        props.class,
      ]}
      style={{ 'transition-duration': `${props.durationMs ?? 300}ms` }}
    >
      {props.children(visibleKey())}
    </div>
  );
}
