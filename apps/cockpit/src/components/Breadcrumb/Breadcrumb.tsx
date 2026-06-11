import { useMatches } from '@tanstack/react-router';
import { Fragment } from 'react';
import { cx } from '@/utils/styles.ts';

import type { IconType } from 'react-icons';

export type Crumb = { label: string } | { icon: IconType };

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    crumb?: Crumb;
  }
}

export function Breadcrumb() {
  const matches = useMatches().filter((m) => m.staticData?.crumb);

  return (
    <div className="w-full flex flex-row flex-nowrap gap-2 items-center">
      {matches.map((item, index) => {
        if (!item.staticData?.crumb) return null;
        return (
          <Fragment key={item.id}>
            {index > 0 && <BreadcrumbDelimiter />}
            <BreadcrumbItem
              crumb={item.staticData.crumb}
              href={item.pathname}
            />
          </Fragment>
        );
      })}
    </div>
  );
}

export function BreadcrumbItem({
  crumb,
  href,
}: {
  crumb: Crumb;
  href?: string;
}) {
  const iconMode = 'icon' in crumb;
  return (
    <a
      href={href}
      className={cx('font-medium', iconMode ? 'text-lg' : 'text-md')}
    >
      {iconMode ? <crumb.icon /> : crumb.label}
    </a>
  );
}

export function BreadcrumbDelimiter() {
  return <span className="text-(--color-txt-sec)">|</span>;
}
