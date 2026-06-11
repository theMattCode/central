import { describe, expect, it } from 'vitest';
import { WMO_CODE_MAP } from '@/domain/weather/model/wmo.ts';

const EXPECTED_WMO_CODES = [
  0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99,
];

function isSvgAssetUrl(icon: string) {
  return icon.includes('.svg') || icon.startsWith('data:image/svg+xml');
}

describe('WMO model', () => {
  it('maps each supported WMO code to meteocons SVG assets', () => {
    expect(
      Object.keys(WMO_CODE_MAP)
        .map(Number)
        .sort((left, right) => left - right),
    ).toEqual(EXPECTED_WMO_CODES);

    for (const info of Object.values(WMO_CODE_MAP)) {
      expect(isSvgAssetUrl(info.day)).toBe(true);
      expect(isSvgAssetUrl(info.night)).toBe(true);
    }
  });

  it('keeps distinct icons for special fog, freezing, and hail cases', () => {
    expect(WMO_CODE_MAP[45].day).not.toBe(WMO_CODE_MAP[48].day);
    expect(WMO_CODE_MAP[51].day).not.toBe(WMO_CODE_MAP[56].day);
    expect(WMO_CODE_MAP[61].day).not.toBe(WMO_CODE_MAP[66].day);
    expect(WMO_CODE_MAP[95].day).not.toBe(WMO_CODE_MAP[96].day);
    expect(WMO_CODE_MAP[96].day).not.toBe(WMO_CODE_MAP[99].day);
  });
});
