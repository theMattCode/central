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
        'w-full flex flex-row items-center hover:bg-(--color-pri)/10 rounded-lg transition-colors px-2 py-1',
        compact ? 'justify-center' : 'gap-2 ',
      )}
      href={href}
      onClick={onClick}
    >
      {Icon && <Icon className="w-6 h-6 text-(--color-txt-sec)" />}
      {!compact && <div className="truncate hidden @[14rem]:block">{children}</div>}
    </a>
  );
}
