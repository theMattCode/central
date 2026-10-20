import type { JarvisMode } from '@/domain/assistant/Jarvis/model.ts';
import { createMemo } from 'solid-js';
import type { JSX } from '@solidjs/web';

type JarvisOrbProps = {
  bars: number[];
  energy: number;
  mode: JarvisMode;
};

export function JarvisOrb(props: JarvisOrbProps) {
  const activity = createMemo(() => props.bars.reduce((sum, value) => sum + value, 0) / props.bars.length);

  return (
    <div
      class="jarvis-reactor"
      data-mode={props.mode}
      style={
        {
          '--jarvis-energy': props.energy.toFixed(3),
          '--jarvis-orb-scale': (0.985 + activity() * 0.05).toFixed(3),
          '--jarvis-pulse-opacity': (0.16 + props.energy * 0.48).toFixed(3),
          '--jarvis-pulse-scale': (0.94 + props.energy * 0.22).toFixed(3),
        } as JSX.CSSProperties
      }
    >
      <div class="jarvis-reactor__pulse" aria-hidden="true" />
      <div class="jarvis-reactor__orb" aria-hidden="true">
        <div class="jarvis-reactor__layer jarvis-reactor__layer--well" />
        <div class="jarvis-reactor__layer jarvis-reactor__layer--outermost" />
        <div class="jarvis-reactor__layer jarvis-reactor__layer--outer" />
        <div class="jarvis-reactor__layer jarvis-reactor__layer--middle" />
        <div class="jarvis-reactor__layer jarvis-reactor__layer--middle-alt" />
        <div class="jarvis-reactor__layer jarvis-reactor__layer--middle-haze" />
        <div class="jarvis-reactor__layer jarvis-reactor__layer--inner" />
        <div class="jarvis-reactor__layer jarvis-reactor__layer--core-ring" />
        <div class="jarvis-reactor__layer jarvis-reactor__layer--core-arc" />
        <div class="jarvis-reactor__layer jarvis-reactor__layer--core-dot" />
        <div class="jarvis-reactor__layer jarvis-reactor__layer--lens" />
      </div>
    </div>
  );
}
