import * as React from 'react';

type Props = {
  children: React.ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
};

export function Typography({ children, variant }: Props) {
  switch (variant) {
    case 'h1':
      return <span className="text-2xl text-(--color-txt) font-semibold">{children}</span>;
    default:
      return <span>{children}</span>;
  }
}
