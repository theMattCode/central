import type { ComponentType, MouseEventHandler, PropsWithChildren } from 'react';
import { cx } from '@/utils/styles.ts';

type NavigationItemProps = PropsWithChildren<{
  Icon?: ComponentType<{ className?: string }>;
  href?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  compact?: boolean;
}>;

export function NavigationItem({ Icon, children, href = '/', onClick, compact = false }: NavigationItemProps) {
  return (
    <a
      className={cx(
        'w-full flex flex-row items-center hover:bg-(--color-pri)/10 rounded-lg transition-colors',
        compact ? 'justify-center p-2' : 'gap-2 p-2',
      )}
      href={href}
      onClick={onClick}
    >
      {Icon && <Icon className="w-6 h-6 text-(--color-txt-sec)" />}
      {!compact && <div className="truncate">{children}</div>}
    </a>
  );
}
