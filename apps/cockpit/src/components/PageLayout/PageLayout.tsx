import type { PropsWithChildren } from 'react';

/**
 * Component that sets up a full-screen container with a background.
 *
 *
 *
 * @param {Object} props - The props for this component.
 * @param {React.ReactNode} props.children - The child components to be rendered within the full-screen container.
 */
export function PageLayout({ children }: PropsWithChildren) {
  return (
    <div className="h-dvh w-full min-h-0 overflow-hidden flex flex-col md:flex-row transition-all">{children}</div>
  );
}
