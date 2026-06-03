import { type PropsWithChildren } from 'react';
import { Breadcrumb } from '@/components/Breadcrumb/Breadcrumb.tsx';

export function ContentLayout({ children }: PropsWithChildren) {
  return (
    <main className="w-full min-h-0 flex flex-col lg:flex-row gap-4 overflow-hidden py-4 pr-4">
      <div className="h-full flex flex-1 flex-wrap gap-4 overflow-auto rounded-2xl bg-(--color-content-bg) @container p-4">
        <div className="flex flex-row items-center justify-between">
          <Breadcrumb />
        </div>
        {children}
      </div>
      {/*
      <div className="h-12 lg:h-full lg:w-64 rounded-lg lg:rounded-xl border-2 border-(--color-pri)/60 bg-(--color-pri)/10 overflow-y-auto px-2 lg:px-4">
        Chat & Agent Logs
      </div>
      */}
    </main>
  );
}
