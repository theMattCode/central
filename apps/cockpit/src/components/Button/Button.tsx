import type { IconType } from 'react-icons';
import { cx } from '@/utils/styles.ts';
import { type ButtonHTMLAttributes, type PropsWithChildren } from 'react';

export interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: IconType;
  text?: string;
  shape?: 'circle' | 'square';
}

export function Button({
  icon: Icon,
  text,
  shape,
  ...buttonProps
}: PropsWithChildren<Props>) {
  return (
    <button
      className={cx(
        shape === 'circle' ? 'rounded-full aspect-square' : 'rounded-md',
        'flex gap-2 py-1 px-2 items-center justify-center',
        'border-2 border-(--color-pri)/60 bg-(--color-pri)/10 hover:bg-(--color-pri)/15 active:bg-(--color-pri)/25 focus:bg-(--color-pri)/20 text-(--color-text) disabled:opacity-50',
      )}
      {...buttonProps}
    >
      {Icon && <Icon className="h-5 w-5" />}
      {text && <span className="">{text}</span>}
    </button>
  );
}
