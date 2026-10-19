import { createEffect, type ParentProps } from 'solid-js';
import { captureException } from '@sentry/core';
import { clientOnly } from '@solidjs/web';
import { createRootRoute, HeadContent, Scripts } from '@tanstack/solid-router';
import appCss from '../styles.css?url';
import { PageLayout } from '@/components/PageLayout/PageLayout.tsx';
import { Section } from '@/components/Section/Section.tsx';
import { ContentArea } from '@/components/ContentArea/ContentArea.tsx';
import { Navigation } from '@/components/Navigation/Navigation.tsx';
import { MdOutlineHome as HomeIcon } from 'solid-icons/md';

const Devtools = import.meta.env.DEV
  ? clientOnly(() => import('@/components/Devtools/Devtools.tsx'), { export: 'Devtools', lazy: true })
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

function RootDocument(props: ParentProps) {
  return (
    <html lang="en">
      <head title={title}>
        <HeadContent />
      </head>
      <body>
        <PageLayout>
          <Navigation />
          <ContentArea>{props.children}</ContentArea>
        </PageLayout>
        {Devtools ? <Devtools /> : null}
        <Scripts />
      </body>
    </html>
  );
}

function RootErrorBoundary(props: { error: unknown }) {
  createEffect(
    () => props.error,
    (error) => {
      captureException(error);
    },
  );

  return (
    <Section>
      <div class="flex flex-col gap-2">
        <h1 class="text-lg font-semibold">Application Error</h1>
        <p>{props.error instanceof Error ? props.error.message : 'unexpected application error.'}</p>
      </div>
    </Section>
  );
}
