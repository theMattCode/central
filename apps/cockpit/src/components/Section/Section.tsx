import type { PropsWithChildren } from 'react';
import { cx } from '@/utils/styles.ts';

interface Props {
  className?: string;
}

export function Section({ children, className }: PropsWithChildren<Props>) {
  return (
    <div
      className={cx(
        'self-start w-full h-full bg-(--color-bg) flex p-4 rounded-lg border border-(--color-section-border) @container',
        className,
      )}
    >
      {children}
    </div>
  );
}
