import { Fragment, type PropsWithChildren } from 'react';
import { useRouterState } from '@tanstack/react-router';

export function ContentLayout({ children }: PropsWithChildren) {
  return (
    <main className="w-full min-h-0 py-4 pr-4 flex flex-col lg:flex-row gap-4 overflow-hidden">
      <div className="border-l border-l-(--color-section-border) flex-1 min-h-0 py-4 flex flex-col gap-4 overflow-hidden @container">
        <div className="px-4">
          <Breadcrumb />
        </div>
        <div className="h-full flex flex-row flex-wrap gap-4 overflow-y-auto px-4">{children}</div>
      </div>
      <div className="h-12 lg:h-full lg:w-64 rounded-lg lg:rounded-xl border-2 border-(--color-pri)/60 bg-(--color-pri)/10 overflow-y-auto px-2 lg:px-4">
        Chat & Agent Logs
      </div>
    </main>
  );
}

const BREADCRUMB_BY_PATH: Record<string, readonly string[]> = {
  '/': ['Home', 'Dashboard'],
  '/jarvis': ['Home', 'Jarvis'],
};

export function getBreadcrumbItems(pathname: string) {
  return BREADCRUMB_BY_PATH[pathname] ?? BREADCRUMB_BY_PATH['/'];
}

export function Breadcrumb() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = getBreadcrumbItems(pathname);

  return (
    <div className="w-full flex gap-2">
      {items.map((item, index) => (
        <Fragment key={item}>
          {index > 0 && <BreadcrumbDelimiter />}
          <BreadcrumbItem text={item} />
        </Fragment>
      ))}
    </div>
  );
}

export function BreadcrumbItem({ text }: { text: string }) {
  return <span className="text-sm font-medium">{text}</span>;
}

export function BreadcrumbDelimiter() {
  return <BreadcrumbItem text="&gt;" />;
}
