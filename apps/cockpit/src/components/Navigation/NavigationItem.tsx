import type { ParentProps } from 'solid-js';
import type { IconTypes } from 'solid-icons';
import { dynamic } from '@solidjs/web';
import { Icon } from '@/components/Icon/Icon.tsx';

type NavigationItemProps = ParentProps<{
  Icon?: IconTypes;
  href?: string;
  onClick?: () => void;
  compact?: boolean;
}>;

export function NavigationItem(props: NavigationItemProps) {
  const Element = dynamic(() => (props.href ? 'a' : 'button'));
  return (
    <Element
      type={props.href ? undefined : 'button'}
      href={props.href}
      class={[
        'w-full flex flex-row items-center rounded-lg border-0 bg-transparent px-2 py-1 text-left text-(--color-txt) no-underline transition-colors hover:bg-(--color-pri)/10',
        { 'justify-center': Boolean(props.compact), 'gap-2': !props.compact },
      ]}
      onClick={props.onClick}
    >
      {props.Icon && <Icon icon={props.Icon} class="h-6 w-6 text-(--color-txt-sec)" />}
      {!props.compact && <div class="hidden truncate @[14rem]:block">{props.children}</div>}
    </Element>
  );
}
