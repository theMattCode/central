import type { ComponentType, PropsWithChildren, ReactNode } from 'react';
import { MdChevronLeft as ExpandIcon } from 'react-icons/md';

type NavigationGroupProps = PropsWithChildren<{
  Icon?: ComponentType<{ className?: string }>;
  title: string;
}>;

export function NavigationGroup({ Icon, title, children }: NavigationGroupProps) {
  return (
    <details className="group w-full" open>
      <summary className="hidden w-full cursor-pointer list-none @[14rem]:flex [&::-webkit-details-marker]:hidden py-2">
        <NavigationGroupHeading Icon={Icon} title={title}>
          <ExpandIcon
            aria-hidden="true"
            className="h-4 w-4 shrink-0 rotate-0 text-(--color-txt-sec) transition-transform duration-180 group-open:-rotate-90"
          />
        </NavigationGroupHeading>
      </summary>
      <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-180 group-open:grid-rows-[1fr]">
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-1">{children}</div>
        </div>
      </div>
    </details>
  );
}

function NavigationGroupHeading({ Icon, title, children }: NavigationGroupProps & { children?: ReactNode }) {
  return (
    <div className="flex w-full flex-row items-center gap-2 px-2 text-(--color-txt-sec)">
      {Icon && <Icon className="w-4 h-4" />}
      <div className="truncate text-xs uppercase tracking-[0.14em] text-(--color-txt-sec)">{title}</div>
      <div
        aria-hidden="true"
        data-testid="navigation-group-divider"
        className="min-w-4 flex-1 border-t border-(--color-section-border)"
      />
      <div data-testid="navigation-group-toggle-icon">{children}</div>
    </div>
  );
}
