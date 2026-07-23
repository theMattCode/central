import type { IconType } from 'react-icons';
import { cx } from '@/utils/styles.ts';
import { type ButtonHTMLAttributes, type PropsWithChildren } from 'react';

export interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: IconType;
  inline?: boolean;
  text?: string;
  shape?: 'circle' | 'square';
}

export function Button({ icon: Icon, inline, text, shape, ...buttonProps }: PropsWithChildren<Props>) {
  return (
    <button
      {...buttonProps}
      className={cx(
        shape === 'circle'
          ? 'rounded-full aspect-square'
          : shape === 'square'
            ? 'rounded-md aspect-square'
            : 'rounded-md',
        inline ? 'inline-flex p-1' : 'flex flex-row no-wrap py-1 px-2',
        'gap-2 items-center justify-center',
        'border border-(--color-pri) bg-(--color-pri)/10 hover:bg-(--color-pri)/15 active:bg-(--color-pri)/25 focus:bg-(--color-pri)/20 text-(--color-text) disabled:opacity-50',
        buttonProps.className,
      )}
    >
      {Icon && <Icon className={inline ? 'h-fit' : 'h-5 w-5'} />}
      {text && <span className="">{text}</span>}
    </button>
  );
}
