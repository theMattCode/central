import type { JarvisMode } from '@/domain/assistant/Jarvis/model.ts';
import { type CSSProperties, useMemo } from 'react';

type JarvisOrbProps = {
  bars: number[];
  energy: number;
  mode: JarvisMode;
};

export function JarvisOrb({ bars, energy, mode }: JarvisOrbProps) {
  const activity = useMemo(() => bars.reduce((sum, value) => sum + value, 0) / bars.length, [bars]);

  return (
    <div
      className="jarvis-reactor"
      data-mode={mode}
      style={
        {
          '--jarvis-energy': energy.toFixed(3),
          '--jarvis-orb-scale': (0.985 + activity * 0.05).toFixed(3),
          '--jarvis-pulse-opacity': (0.16 + energy * 0.48).toFixed(3),
          '--jarvis-pulse-scale': (0.94 + energy * 0.22).toFixed(3),
        } as CSSProperties
      }
    >
      <div className="jarvis-reactor__pulse" aria-hidden="true" />
      <div className="jarvis-reactor__orb" aria-hidden="true">
        <div className="jarvis-reactor__layer jarvis-reactor__layer--well" />
        <div className="jarvis-reactor__layer jarvis-reactor__layer--outermost" />
        <div className="jarvis-reactor__layer jarvis-reactor__layer--outer" />
        <div className="jarvis-reactor__layer jarvis-reactor__layer--middle" />
        <div className="jarvis-reactor__layer jarvis-reactor__layer--middle-alt" />
        <div className="jarvis-reactor__layer jarvis-reactor__layer--middle-haze" />
        <div className="jarvis-reactor__layer jarvis-reactor__layer--inner" />
        <div className="jarvis-reactor__layer jarvis-reactor__layer--core-ring" />
        <div className="jarvis-reactor__layer jarvis-reactor__layer--core-arc" />
        <div className="jarvis-reactor__layer jarvis-reactor__layer--core-dot" />
      </div>
    </div>
  );
}
