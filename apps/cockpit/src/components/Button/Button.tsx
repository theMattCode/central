import type { IconTypes } from 'solid-icons';
import { omit, type ParentProps } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Icon } from '@/components/Icon/Icon.tsx';

export interface Props extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: IconTypes;
  text?: string;
  shape?: 'circle' | 'square';
}

export function Button(props: ParentProps<Props>) {
  const buttonProps = omit(props, 'children', 'class', 'icon', 'text', 'shape');
  return (
    <button
      {...buttonProps}
      class={[
        props.shape === 'circle' ? 'rounded-full aspect-square' : 'rounded-md',
        'flex gap-2 py-1 px-2 items-center justify-center',
        'border-2 border-(--color-pri)/60 bg-(--color-pri)/10 hover:bg-(--color-pri)/15 active:bg-(--color-pri)/25 focus:bg-(--color-pri)/20 text-(--color-text) disabled:opacity-50',
        props.class,
      ]}
    >
      {props.icon && <Icon icon={props.icon} class="h-5 w-5" />}
      {props.text && <span>{props.text}</span>}
    </button>
  );
}
