import type { PropsWithChildren } from 'react';
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';
import { PageLayout } from '@/components/Layout/PageLayout.tsx';
import { Devtools } from '@/components/Devtools/Devtools.tsx';
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
