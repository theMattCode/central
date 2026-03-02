import type { PropsWithChildren } from 'react';

type NavigationItemProps = PropsWithChildren<{
  Icon?: React.ComponentType<{ className?: string }>;
}>;

export function NavigationItem({ Icon, children }: NavigationItemProps) {
  return (
    <a className="w-20 lg:w-full flex flex-row gap-2 items-center hover:bg-(--color-pri)/10 rounded-lg p-1" href="/">
      {Icon && <Icon className="w-6 h-6 text-(--color-txt-group)" />}
      <div className="truncate">{children}</div>
    </a>
  );
}
