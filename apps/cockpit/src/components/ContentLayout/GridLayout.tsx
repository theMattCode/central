import type { PropsWithChildren } from 'react';

export function GridLayout({ children }: PropsWithChildren) {
  return (
    <div className="pr-4 h-full overflow-auto grid gap-4 grid-cols-1 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-12">
      {children}
    </div>
  );
}
