import { useMatches } from '@tanstack/react-router';
import { Fragment } from 'react';

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
    <div className="w-full h-8 flex flex-row flex-nowrap gap-2 items-center">
      {matches.map((item, index) => {
        if (!item.staticData?.crumb) return null;
        return (
          <Fragment key={item.id}>
            {index > 0 && <Delimiter />}
            <Crumb crumb={item.staticData.crumb} href={item.pathname} />
          </Fragment>
        );
      })}
    </div>
  );
}

function Crumb({ crumb, href }: { crumb: Crumb; href?: string }) {
  return (
    <a href={href} className="flex flex-row flex-nowrap text-nowrap items-center gap-2 font-medium text-md">
      {'icon' in crumb && <crumb.icon className="text-lg" />}
      {'label' in crumb && crumb.label}
    </a>
  );
}

function Delimiter() {
  return <span className="text-(--color-txt-sec)">|</span>;
}
