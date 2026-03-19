import { I18NKey } from '@/i18n/translations.ts';

/**
 * WMO weather interpretation codes
 *
 * | Code       | Description                                      |
 * | ---------- | ------------------------------------------------ |
 * | 0          | Clear sky                                        |
 * | 1, 2, 3    | Mainly clear, partly cloudy, and overcast        |
 * | 45, 48     | Fog and depositing rime fog                      |
 * | 51, 53, 55 | Drizzle: Light, moderate, and dense intensity    |
 * | 56, 57     | Freezing Drizzle: Light and dense intensity      |
 * | 61, 63, 65 | Rain: Slight, moderate and heavy intensity       |
 * | 66, 67     | Freezing Rain: Light and heavy intensity         |
 * | 71, 73, 75 | Snow fall: Slight, moderate, and heavy intensity |
 * | 77         | Snow grains                                      |
 * | 80, 81, 82 | Rain showers: Slight, moderate, and violent      |
 * | 85, 86     | Snow showers slight and heavy                    |
 * | 95         | Thunderstorm: Slight or moderate                 |
 * | 96, 99     | Thunderstorm with slight and heavy hail          |
 */
export const WMO_CODE_INFO: Record<number, { day: string; night: string; i18nKey: I18NKey }> = {
  0: { day: 'clear-day', night: 'clear-night', i18nKey: I18NKey.WmoClearSky },
  1: { day: 'clear-day', night: 'clear-night', i18nKey: I18NKey.WmoMainlyClear },
  2: { day: 'partly-cloudy-day', night: 'partly-cloudy-night', i18nKey: I18NKey.WmoPartlyCloudy },
  3: { day: 'overcast-day', night: 'overcast-night', i18nKey: I18NKey.WmoOvercast },
  45: { day: 'fog-day', night: 'fog-night', i18nKey: I18NKey.WmoFog },
  48: { day: 'rime-fog', night: 'rime-fog', i18nKey: I18NKey.WmoDepositingRimeFog },
  51: { day: 'partly-cloudy-day-drizzle', night: 'partly-cloudy-night-drizzle', i18nKey: I18NKey.WmoLightDrizzle },
  53: {
    day: 'overcast-cloudy-day-drizzle',
    night: 'overcast-cloudy-night-drizzle',
    i18nKey: I18NKey.WmoModerateDrizzle,
  },
  55: { day: 'extreme-day-drizzle', night: 'extreme-night-drizzle', i18nKey: I18NKey.WmoDenseDrizzle },
  56: { day: 'overcast-day-drizzle', night: 'overcast-night-drizzle', i18nKey: I18NKey.WmoLightFreezingDrizzle },
  57: { day: 'extreme-day-drizzle', night: 'extreme-night-drizzle', i18nKey: I18NKey.WmoHeavyFreezingDrizzle },
  61: { day: 'partly-cloudy-day-rain', night: 'partly-cloudy-night-rain', i18nKey: I18NKey.WmoSlightRain },
  63: { day: 'rain', night: 'rain', i18nKey: I18NKey.WmoModerateRain },
  65: { day: 'extreme-day-rain', night: 'extreme-night-rain', i18nKey: I18NKey.WmoHeavyRain },
  66: { day: 'overcast-day-sleet', night: 'overcast-night-sleet', i18nKey: I18NKey.WmoLightFreezingRain },
  67: { day: 'extreme-day-sleet', night: 'extreme-night-sleet', i18nKey: I18NKey.WmoHeavyFreezingRain },
  71: { day: 'snow', night: 'snow', i18nKey: I18NKey.WmoSlightSnowFall },
  73: { day: 'overcast-day-snow', night: 'overcast-night-snow', i18nKey: I18NKey.WmoModerateSnowFall },
  75: { day: 'extreme-day-snow', night: 'extreme-night-snow', i18nKey: I18NKey.WmoHeavySnowFall },
  77: { day: 'extreme-day-hail', night: 'extreme-night-hail', i18nKey: I18NKey.WmoSnowGrains },
  80: { day: 'partly-cloudy-day-rain', night: 'partly-cloudy-night-rain', i18nKey: I18NKey.WmoSlightRainShowers },
  81: { day: 'overcast-day-rain', night: 'overcast-night-rain', i18nKey: I18NKey.WmoModerateRainShowers },
  82: { day: 'extreme-day-rain', night: 'extreme-night-rain', i18nKey: I18NKey.WmoViolentRainShowers },
  85: { day: 'snow', night: 'snow', i18nKey: I18NKey.WmoSlightSnowShowers },
  86: { day: 'extreme-day-snow', night: 'extreme-night-snow', i18nKey: I18NKey.WmoHeavySnowShowers },
  95: { day: 'thunderstorms-day', night: 'thunderstorms-night', i18nKey: I18NKey.WmoThunderstorm },
  96: {
    day: 'thunderstorms-day-overcast-rain',
    night: 'thunderstorms-night-overcast-rain',
    i18nKey: I18NKey.WmoThunderstormWithSlightHail,
  },
  99: {
    day: 'thunderstorms-day-extreme-rain',
    night: 'thunderstorms-night-extreme-rain',
    i18nKey: I18NKey.WmoThunderstormWithHeavyHail,
  },
};
