import { type PropsWithChildren, useEffect, useState } from 'react';
import { cx } from '@/utils/styles.ts';

type FadeTransitionProps = PropsWithChildren<{
  transitionKey: string | number;
  durationMs?: number;
  className?: string;
}>;

type FadePhase = 'entered' | 'exiting' | 'entering';

export function FadeTransition({
  children,
  transitionKey,
  durationMs = 300,
  className,
}: FadeTransitionProps) {
  const [visibleChildren, setVisibleChildren] = useState(children);
  const [visibleKey, setVisibleKey] = useState(transitionKey);
  const [phase, setPhase] = useState<FadePhase>('entered');

  useEffect(() => {
    if (transitionKey === visibleKey) {
      setVisibleChildren(children);
      return;
    }

    setPhase('exiting');
  }, [children, transitionKey, visibleKey]);

  useEffect(() => {
    if (phase !== 'exiting') {
      return;
    }

    const exitTimeout = setTimeout(() => {
      setVisibleChildren(children);
      setVisibleKey(transitionKey);
      setPhase('entering');
    }, durationMs);

    return () => clearTimeout(exitTimeout);
  }, [children, durationMs, phase, transitionKey]);

  useEffect(() => {
    if (phase !== 'entering') {
      return;
    }
    const enterTimeout = setTimeout(() => setPhase('entered'), 16);
    return () => clearTimeout(enterTimeout);
  }, [phase]);

  return (
    <div
      className={cx(
        'transition-opacity',
        phase === 'entered' ? 'opacity-100' : 'opacity-0',
        className,
      )}
      style={{ transitionDuration: `${durationMs}ms` }}
    >
      {visibleChildren}
    </div>
  );
}
