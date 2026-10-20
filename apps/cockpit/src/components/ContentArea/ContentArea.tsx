import { type ParentProps } from 'solid-js';
import { Breadcrumb } from '@/components/Breadcrumb/Breadcrumb.tsx';

export function ContentArea(props: ParentProps) {
  return (
    <main class="w-full min-h-0 flex flex-col lg:flex-row overflow-hidden lg:py-4">
      <div class="h-full flex flex-1 flex-col gap-4 overflow-hidden md:rounded-l-2xl md:glass-tray md:border md:border-r-0 md:border-(--glass-border) @container py-4 pl-4 transition-all">
        <div class="flex flex-row items-center">
          <Breadcrumb />
        </div>
        {props.children}
      </div>
    </main>
  );
}
