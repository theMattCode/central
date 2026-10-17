import type { PropsWithChildren } from 'react';

export function GridLayout({ children }: PropsWithChildren) {
  return <div className="pr-4 overflow-auto grid-layout">{children}</div>;
}
