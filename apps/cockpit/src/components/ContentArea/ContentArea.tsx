import { type PropsWithChildren } from 'react';
import { Breadcrumb } from '@/components/Breadcrumb/Breadcrumb.tsx';

export function ContentArea({ children }: PropsWithChildren) {
  return (
    <main className="w-full min-h-0 flex flex-col lg:flex-row gap-4 overflow-hidden py-4">
      <div className="h-full flex flex-1 flex-col gap-4 overflow-auto md:rounded-l-2xl md:bg-(--color-content-bg) @container p-4 transition-all">
        <div className="flex flex-row items-center">
          <Breadcrumb />
        </div>
        {children}
      </div>
    </main>
  );
}
