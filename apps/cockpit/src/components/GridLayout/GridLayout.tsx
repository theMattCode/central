import type { ParentProps } from 'solid-js';

export function GridLayout(props: ParentProps) {
  return <div class="pr-4 overflow-auto grid-layout">{props.children}</div>;
}
