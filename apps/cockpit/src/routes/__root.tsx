import type { PropsWithChildren } from 'react';
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';
import { PageLayout } from '@/components/Layout/PageLayout.tsx';
import { Devtools } from '@/components/Devtools/Devtools.tsx';
import { Section } from '@/components/Section/Section.tsx';
import appCss from '../styles.css?url';
import { ContentLayout } from '@/components/Layout/ContentLayout.tsx';
import { Navigation } from '@/components/Navigation/Navigation.tsx';

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
