import { Show, type ParentProps } from 'solid-js';
import type { IconTypes } from 'solid-icons';
import { Link, type LinkProps } from '@tanstack/solid-router';
import { Icon } from '@/components/Icon/Icon.tsx';

type NavigationItemProps = ParentProps<{
  Icon?: IconTypes;
  to?: LinkProps['to'];
  onClick?: () => void;
  compact?: boolean;
}>;

export function NavigationItem(props: NavigationItemProps) {
  // A plain string, because Link concatenates class strings and would stringify an array/object class.
  const className = () =>
    `w-full flex flex-row items-center rounded-lg border-0 bg-transparent px-2 py-1 text-left text-(--color-txt) no-underline transition-colors hover:bg-(--color-pri)/10 ${props.compact ? 'justify-center' : 'gap-2'}`;
  const content = () => (
    <>
      {props.Icon && <Icon icon={props.Icon} class="h-6 w-6 text-(--color-txt-sec)" />}
      {!props.compact && <div class="hidden truncate @[14rem]:block">{props.children}</div>}
    </>
  );

  // Router links navigate client-side; a plain anchor would reload the document and flash the default background.
  return (
    <Show
      when={props.to}
      fallback={
        <button type="button" class={className()} onClick={props.onClick}>
          {content()}
        </button>
      }
    >
      {(to) => (
        <Link to={to()} class={className()} onClick={props.onClick}>
          {content()}
        </Link>
      )}
    </Show>
  );
}
