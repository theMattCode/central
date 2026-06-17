import { lazy, type PropsWithChildren } from 'react';
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';
import appCss from '../styles.css?url';
import { PageLayout } from '@/components/PageLayout/PageLayout.tsx';
import { Section } from '@/components/Section/Section.tsx';
import { ContentLayout } from '@/components/ContentLayout/ContentLayout.tsx';
import { Navigation } from '@/components/Navigation/Navigation.tsx';
import { MdOutlineHome as HomeIcon } from 'react-icons/md';

const Devtools = import.meta.env.DEV
  ? lazy(() => import('@/components/Devtools/Devtools.tsx').then((module) => ({ default: module.Devtools })))
  : null;
const title = 'Central Dashboard';

export const Route = createRootRoute({
  head: () => ({
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }, { title }],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  errorComponent: RootErrorBoundary,
  shellComponent: RootDocument,
  staticData: {
    crumb: { icon: HomeIcon },
  },
});

function RootDocument({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head title={title}>
        <HeadContent />
      </head>
      <body>
        <PageLayout>
          <Navigation />
          <ContentLayout>{children}</ContentLayout>
        </PageLayout>
        {Devtools ? <Devtools /> : null}
        <Scripts />
      </body>
    </html>
  );
}

function RootErrorBoundary({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'unexpected application error.';

  return (
    <Section>
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold">Application Error</h1>
        <p>{message}</p>
      </div>
    </Section>
  );
}
