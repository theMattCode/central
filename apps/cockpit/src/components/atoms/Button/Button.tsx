import type { IconType } from 'react-icons';
import { cx } from '@/utils/styles.ts';
import { type MouseEventHandler } from 'react';
import * as React from 'react';

export interface Props {
  name: string;
  type?: React.ButtonHTMLAttributes<HTMLButtonElement>['type'];
  icon?: IconType;
  text?: string;
  shape?: 'circle' | 'square';
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
}

export function Button({ name, type = 'button', icon: Icon, text, shape, onClick, disabled }: Props) {
  return (
    <button
      type={type}
      aria-label={name}
      name={name}
      title={text}
      disabled={disabled}
      className={cx(
        shape === 'circle' ? 'rounded-full aspect-square' : 'rounded-md',
        'border-2 border-(--color-pri)/60 bg-(--color-pri)/10 hover:bg-(--color-pri)/15 active:bg-(--color-pri)/25 focus:bg-(--color-pri)/20 text-(--color-text) disabled:opacity-50 flex gap-2 py-1 px-2 items-center justify-center',
      )}
      onClick={onClick}
    >
      {Icon && <Icon className="h-5 w-5" />}
      {text && <span className="">{text}</span>}
    </button>
  );
}
