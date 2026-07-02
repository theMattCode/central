import type { PropsWithChildren } from 'react';
import { cx } from '@/utils/styles.ts';

interface Props {
  className?: string;
}

export function Section({ children, className }: PropsWithChildren<Props>) {
  return <div className={cx('section-base', className)}>{children}</div>;
}
