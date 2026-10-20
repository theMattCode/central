import type { ParentProps } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { IconTypes } from 'solid-icons';
import { MdFillChevron_left as ExpandIcon } from 'solid-icons/md';
import { Icon } from '@/components/Icon/Icon.tsx';

type NavigationGroupProps = ParentProps<{
  Icon?: IconTypes;
  title: string;
}>;

export function NavigationGroup(props: NavigationGroupProps) {
  return (
    <details class="group w-full" open>
      <summary class="hidden w-full cursor-pointer list-none @[14rem]:flex [&::-webkit-details-marker]:hidden py-2">
        <NavigationGroupHeading Icon={props.Icon} title={props.title}>
          <Icon
            icon={ExpandIcon}
            class="h-4 w-4 rotate-0 text-(--color-txt-sec) transition-transform duration-180 group-open:-rotate-90"
          />
        </NavigationGroupHeading>
      </summary>
      <div class="grid grid-rows-[0fr] transition-[grid-template-rows] duration-180 group-open:grid-rows-[1fr]">
        <div class="min-h-0 overflow-hidden">
          <div class="flex flex-col gap-1">{props.children}</div>
        </div>
      </div>
    </details>
  );
}

function NavigationGroupHeading(props: NavigationGroupProps & { children?: JSX.Element }) {
  return (
    <div class="flex w-full flex-row items-center gap-2 px-2 text-(--color-txt-sec)">
      {props.Icon && <Icon icon={props.Icon} class="w-4 h-4" />}
      <div class="truncate text-xs uppercase tracking-[0.14em] text-(--color-txt-sec)">{props.title}</div>
      <div
        aria-hidden="true"
        data-testid="navigation-group-divider"
        class="min-w-4 flex-1 border-t border-(--color-section-border)"
      />
      <div data-testid="navigation-group-toggle-icon">{props.children}</div>
    </div>
  );
}
