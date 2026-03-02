import type { PropsWithChildren } from 'react';

type NavigationGroupProps = PropsWithChildren<{
  title: string;
}>;

export function NavigationGroup({ title, children }: NavigationGroupProps) {
  return (
    <div className="w-20 lg:w-full flex flex-col gap-1 lg:gap-2">
      <div className="truncate text-sm text-(--color-txt-group)">{title}</div>
      {children}
    </div>
  );
}
