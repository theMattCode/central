import type { ParentProps } from 'solid-js';

interface Props {
  class?: string;
}

export function Section(props: ParentProps<Props>) {
  return <div class={['section-base', props.class]}>{props.children}</div>;
}
