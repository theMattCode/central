import { Dynamic } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import type { IconTypes } from 'solid-icons';

type Props = {
  icon: IconTypes;
  class?: JSX.ClassValue;
  label?: string;
  style?: JSX.CSSProperties;
};

export function Icon(props: Props) {
  return (
    <span
      aria-hidden={props.label ? undefined : 'true'}
      aria-label={props.label}
      class={['inline-flex shrink-0 [&>svg]:h-full [&>svg]:w-full', props.class]}
      style={props.style}
    >
      <Dynamic component={props.icon} size="1em" />
    </span>
  );
}
