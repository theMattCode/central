import { useRouterState } from '@tanstack/react-router';
import { Fragment } from 'react';

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
