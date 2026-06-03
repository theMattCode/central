import type { IconType } from 'react-icons';

export type Crumb = { label: string } | { icon: IconType };

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    crumb?: Crumb;
  }
}
