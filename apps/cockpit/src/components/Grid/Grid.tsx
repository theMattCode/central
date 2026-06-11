import type { PropsWithChildren } from 'react';

export function Grid({ children }: PropsWithChildren) {
  return (
    <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] transition-all">
      {children}
    </div>
  );
}
