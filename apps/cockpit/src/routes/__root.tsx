import type { PropsWithChildren } from 'react';
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';
import appCss from '../styles.css?url';
import { PageLayout } from '@/components/PageLayout/PageLayout.tsx';
import { Devtools } from '@/components/Devtools/Devtools.tsx';
import { Section } from '@/components/Section/Section.tsx';
import { ContentLayout } from '@/components/ContentLayout/ContentLayout.tsx';
import { Navigation } from '@/components/Navigation/Navigation.tsx';
import { MdOutlineHome as HomeIcon } from 'react-icons/md';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Central Dashboard' },
    ],
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
      <head>
        <HeadContent />
      </head>
      <body>
        <PageLayout>
          <Navigation />
          <ContentLayout>{children}</ContentLayout>
        </PageLayout>
        <Devtools />
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
