import type { ParentProps } from 'solid-js';

export function Grid(props: ParentProps) {
  return (
    <div class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] transition-all">
      {props.children}
    </div>
  );
}
