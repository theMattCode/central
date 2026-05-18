import { type PropsWithChildren } from 'react';

export { getBreadcrumbItems } from '@/components/Breadcrumb/Breadcrumb.tsx';

export function ContentLayout({ children }: PropsWithChildren) {
  return (
    <main className="w-full min-h-0 py-4 pr-4 flex flex-col lg:flex-row gap-4 overflow-hidden">
      <div className="px-4 h-full border-l border-l-(--color-section-border) flex flex-row flex-1 flex-wrap gap-4 overflow-auto @container">
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
