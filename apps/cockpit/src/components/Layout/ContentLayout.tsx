import { Fragment, type PropsWithChildren } from 'react';

export function ContentLayout({ children }: PropsWithChildren) {
  return (
    <main className="w-full min-h-0 p-4 flex flex-col lg:flex-row gap-4 overflow-hidden">
      <div className="flex-1 min-h-0 py-4 bg-[linear-gradient(to_bottom_right,var(--color-content-bg-start),var(--color-content-bg-end))] rounded-lg lg:rounded-xl flex flex-col gap-4 overflow-hidden @container">
        <div className="px-4">
          <Breadcrumb />
        </div>
        <div className="flex flex-row flex-wrap gap-4 overflow-y-auto px-4">{children}</div>
      </div>
      <div className="h-12 lg:h-full lg:w-64 rounded-lg lg:rounded-xl border-2 border-(--color-pri)/60 bg-(--color-pri)/10 overflow-y-auto px-2 lg:px-4">
        Chat & Agent Logs
      </div>
    </main>
  );
}

const BREADCRUMB = ['Home', 'Dashboard'];

export function Breadcrumb() {
  return (
    <div className="w-full flex gap-2">
      {BREADCRUMB.map((item, index) => (
        <Fragment key={item}>
          {index > 0 && <BreadcrumbDelimiter />}
          <BreadcrumbItem text={item} />
        </Fragment>
      ))}
    </div>
  );
}

export function BreadcrumbItem({ text }: { text: string }) {
  return <span className="text-sm font-medium text-gray-500">{text}</span>;
}

export function BreadcrumbDelimiter() {
  return <BreadcrumbItem text="&gt;" />;
}
