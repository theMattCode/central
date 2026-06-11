import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateWeatherLocation } from '@/domain/weather/model/fetchWeatherData.ts';

describe('validateWeatherLocation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('accepts locations with a timezone', () => {
    const location = {
      id: 'moessingen',
      label: 'Moessingen',
      latitude: 48.4057,
      longitude: 9.0542,
      timezone: 'Europe/Berlin',
    };
    expect(validateWeatherLocation(location)).toEqual(location);
  });

  it('accepts locations without a timezone', () => {
    const input = {
      id: 'obernheim',
      label: 'Obernheim',
      latitude: 48.163,
      longitude: 8.8611,
    };
    const expected = { ...input, timezone: undefined };
    expect(validateWeatherLocation(input)).toEqual(expected);
  });

  it.skip('rejects non-string timezone values', () => {
    expect(() =>
      validateWeatherLocation({
        id: 'bad',
        label: 'Bad',
        latitude: 1,
        longitude: 2,
        timezone: 123,
      }),
    ).toThrow('Invalid weather location payload.');

    /*
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    expect(loggerErrorMock).toHaveBeenCalledWith('invalid-location-payload', {
      payload: {
        id: 'bad',
        label: 'Bad',
        latitude: 1,
        longitude: 2,
        timezone: 123,
      },
    });
     */
  });
});
