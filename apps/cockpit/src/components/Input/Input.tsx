import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input(props: Props) {
  return (
    <input
      className="w-full rounded-md border border-(--color-section-border) bg-(--color-bg) px-3 py-2 text-(--color-txt) outline-none"
      {...props}
    />
  );
}
