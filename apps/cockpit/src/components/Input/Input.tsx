import type { JSX } from '@solidjs/web';
import { omit } from 'solid-js';

type Props = JSX.InputHTMLAttributes<HTMLInputElement>;

export function Input(props: Props) {
  const inputProps = omit(props, 'class');
  return (
    <input
      {...inputProps}
      class={[
        'w-full rounded-md border border-(--color-section-border) bg-(--color-bg) px-3 py-2 text-(--color-txt) outline-none',
        props.class,
      ]}
    />
  );
}
