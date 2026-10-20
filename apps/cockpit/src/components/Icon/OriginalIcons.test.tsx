/* @vitest-environment jsdom */

import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AlarmClockPlusIcon,
  PayMoneyIcon,
  PencilIcon,
  PocketKnifeIcon,
  ReceiveMoneyIcon,
  SidebarSimpleDuotoneIcon,
  WaveformIcon,
  WindDirectionIcon,
} from '@/components/Icon/OriginalIcons.tsx';

afterEach(cleanup);

describe('original migration icons', () => {
  it('preserves the original Lucide icon geometry', () => {
    const { container } = render(() => (
      <>
        <PocketKnifeIcon data-testid="pocket-knife" />
        <AlarmClockPlusIcon data-testid="alarm-clock-plus" />
        <PencilIcon data-testid="pencil" />
      </>
    ));

    expect(container.querySelector('[data-testid="pocket-knife"]')?.querySelectorAll('path')).toHaveLength(5);
    expect(container.querySelector('[data-testid="alarm-clock-plus"]')?.querySelectorAll('circle, path')).toHaveLength(
      7,
    );
    expect(container.querySelector('[data-testid="pencil"]')?.querySelectorAll('path')).toHaveLength(2);
  });

  it('preserves the original Phosphor and Game Icons geometry', () => {
    const { container } = render(() => (
      <>
        <SidebarSimpleDuotoneIcon data-testid="sidebar" />
        <WaveformIcon data-testid="waveform" />
        <WindDirectionIcon data-testid="wind-direction" />
        <PayMoneyIcon data-testid="pay-money" />
        <ReceiveMoneyIcon data-testid="receive-money" />
      </>
    ));

    expect(container.querySelector('[data-testid="sidebar"]')?.querySelectorAll('path')).toHaveLength(2);
    expect(container.querySelector('[data-testid="waveform"]')?.getAttribute('viewBox')).toBe('0 0 256 256');
    expect(container.querySelector('[data-testid="wind-direction"]')?.getAttribute('viewBox')).toBe('0 0 32 32');
    expect(container.querySelector('[data-testid="pay-money"]')?.getAttribute('viewBox')).toBe('0 0 512 512');
    expect(container.querySelector('[data-testid="receive-money"]')?.getAttribute('viewBox')).toBe('0 0 512 512');
  });
});
