import type { PropsWithChildren } from 'react';

export function ContentLayout({ children }: PropsWithChildren) {
  return (
    <main className="flex-1 min-h-0 w-full flex flex-col lg:flex-row gap-4 transition-all">
      <div className="bg-[linear-gradient(to_bottom_right,var(--color-content-bg-start),var(--color-content-bg-end))] p-2 lg:p-4 rounded-lg lg:rounded-xl flex-1 flex ">
        {children}
      </div>
      <div className="h-12 lg:h-full lg:w-64 rounded-lg lg:rounded-xl border-2 border-(--color-pri)/60 bg-(--color-pri)/10 overflow-y-auto p-2 lg:p-4">
        Chat & Agent Logs
      </div>
    </main>
  );
}
