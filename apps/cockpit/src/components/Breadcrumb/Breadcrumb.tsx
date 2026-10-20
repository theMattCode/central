import { useMatches } from '@tanstack/solid-router';
import { createMemo, For, Show } from 'solid-js';
import { Dynamic } from '@solidjs/web';

import type { IconTypes } from 'solid-icons';

export type Crumb = { label: string } | { icon: IconTypes };

declare module '@tanstack/solid-router' {
  interface StaticDataRouteOption {
    crumb?: Crumb;
  }
}

export function Breadcrumb() {
  const matches = useMatches({ select: (matches) => matches.filter((match) => match.staticData?.crumb) });

  return (
    <div class="w-full h-8 flex flex-row flex-nowrap gap-2 items-center">
      <For each={matches()}>
        {(item, index) => {
          if (!item.staticData?.crumb) return null;
          return (
            <>
              {index() > 0 && <BreadcrumbDelimiter />}
              <BreadcrumbItem crumb={item.staticData.crumb} href={item.pathname} />
            </>
          );
        }}
      </For>
    </div>
  );
}

export function BreadcrumbItem(props: { crumb: Crumb; href?: string }) {
  const icon = createMemo(() => ('icon' in props.crumb ? props.crumb.icon : null));
  return (
    <a href={props.href} class={['font-medium', { 'text-lg': Boolean(icon()), 'text-md': !icon() }]}>
      <Show when={icon()} fallback={'label' in props.crumb ? props.crumb.label : null}>
        {(CrumbIcon) => <Dynamic component={CrumbIcon()} />}
      </Show>
    </a>
  );
}

export function BreadcrumbDelimiter() {
  return <span class="text-(--color-txt-sec)">|</span>;
}
