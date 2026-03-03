import type { PropsWithChildren } from 'react';

export function Section({ children }: PropsWithChildren) {
  return (
    <div className="self-start bg-(--color-bg) flex p-4 rounded-lg border border-(--color-section-border)">
      {children}
    </div>
  );
}
