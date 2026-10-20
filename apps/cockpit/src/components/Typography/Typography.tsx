import type { JSX } from '@solidjs/web';

type Props = {
  children: JSX.Element;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
};

export function Typography(props: Props) {
  switch (props.variant) {
    case 'h1':
      return <span class="text-2xl text-(--color-txt) font-semibold">{props.children}</span>;
    default:
      return <span>{props.children}</span>;
  }
}
