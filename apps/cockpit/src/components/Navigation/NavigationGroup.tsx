import type { PropsWithChildren } from 'react';

type NavigationGroupProps = PropsWithChildren<{
  title: string;
}>;

export function NavigationGroup({ title, children }: NavigationGroupProps) {
  return (
    <div className="w-full flex flex-col gap-1">
      <div className="truncate px-2 text-xs uppercase tracking-[0.14em] text-(--color-txt-sec)">{title}</div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}
