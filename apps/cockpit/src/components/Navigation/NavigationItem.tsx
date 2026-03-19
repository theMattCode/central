import type { ComponentType, MouseEventHandler, PropsWithChildren } from 'react';
import { cx } from '@/utils/styles.ts';

type NavigationItemProps = PropsWithChildren<{
  Icon?: ComponentType<{ className?: string }>;
  href?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
  compact?: boolean;
}>;

function getNavigationItemClassName(compact: boolean) {
  return cx(
    'w-full flex flex-row items-center rounded-lg border-0 bg-transparent px-2 py-1 text-left text-(--color-txt) no-underline transition-colors hover:bg-(--color-pri)/10',
    compact ? 'justify-center' : 'gap-2',
  );
}

export function NavigationItem({ Icon, children, href, onClick, compact = false }: NavigationItemProps) {
  const content = (
    <>
      {Icon && <Icon className="h-6 w-6 text-(--color-txt-sec)" />}
      {!compact && <div className="hidden truncate @[14rem]:block">{children}</div>}
    </>
  );

  if (href) {
    return (
      <a className={getNavigationItemClassName(compact)} href={href} onClick={onClick}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" className={getNavigationItemClassName(compact)} onClick={onClick}>
      {content}
    </button>
  );
}
