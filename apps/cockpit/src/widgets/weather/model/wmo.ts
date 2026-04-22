import { I18NKey } from '@/i18n/translations.ts';
import clearDayIcon from '@meteocons/svg/fill/clear-day.svg';
import clearNightIcon from '@meteocons/svg/fill/clear-night.svg';
import drizzleIcon from '@meteocons/svg/fill/drizzle.svg';
import extremeDayDrizzleIcon from '@meteocons/svg/fill/extreme-day-drizzle.svg';
import extremeDayRainIcon from '@meteocons/svg/fill/extreme-day-rain.svg';
import extremeDaySleetIcon from '@meteocons/svg/fill/extreme-day-sleet.svg';
import extremeDaySnowIcon from '@meteocons/svg/fill/extreme-day-snow.svg';
import extremeNightDrizzleIcon from '@meteocons/svg/fill/extreme-night-drizzle.svg';
import extremeNightRainIcon from '@meteocons/svg/fill/extreme-night-rain.svg';
import extremeNightSleetIcon from '@meteocons/svg/fill/extreme-night-sleet.svg';
import extremeNightSnowIcon from '@meteocons/svg/fill/extreme-night-snow.svg';
import fogDayIcon from '@meteocons/svg/fill/fog-day.svg';
import fogNightIcon from '@meteocons/svg/fill/fog-night.svg';
import hailIcon from '@meteocons/svg/fill/hail.svg';
import mostlyClearDayIcon from '@meteocons/svg/fill/mostly-clear-day.svg';
import mostlyClearNightIcon from '@meteocons/svg/fill/mostly-clear-night.svg';
import overcastDayDrizzleIcon from '@meteocons/svg/fill/overcast-day-drizzle.svg';
import overcastDayFogIcon from '@meteocons/svg/fill/overcast-day-fog.svg';
import overcastDayIcon from '@meteocons/svg/fill/overcast-day.svg';
import overcastDayRainIcon from '@meteocons/svg/fill/overcast-day-rain.svg';
import overcastDaySleetIcon from '@meteocons/svg/fill/overcast-day-sleet.svg';
import overcastDaySnowIcon from '@meteocons/svg/fill/overcast-day-snow.svg';
import overcastNightDrizzleIcon from '@meteocons/svg/fill/overcast-night-drizzle.svg';
import overcastNightFogIcon from '@meteocons/svg/fill/overcast-night-fog.svg';
import overcastNightIcon from '@meteocons/svg/fill/overcast-night.svg';
import overcastNightRainIcon from '@meteocons/svg/fill/overcast-night-rain.svg';
import overcastNightSleetIcon from '@meteocons/svg/fill/overcast-night-sleet.svg';
import overcastNightSnowIcon from '@meteocons/svg/fill/overcast-night-snow.svg';
import partlyCloudyDayIcon from '@meteocons/svg/fill/partly-cloudy-day.svg';
import partlyCloudyDayRainIcon from '@meteocons/svg/fill/partly-cloudy-day-rain.svg';
import partlyCloudyDaySnowIcon from '@meteocons/svg/fill/partly-cloudy-day-snow.svg';
import partlyCloudyNightIcon from '@meteocons/svg/fill/partly-cloudy-night.svg';
import partlyCloudyNightRainIcon from '@meteocons/svg/fill/partly-cloudy-night-rain.svg';
import partlyCloudyNightSnowIcon from '@meteocons/svg/fill/partly-cloudy-night-snow.svg';
import rainIcon from '@meteocons/svg/fill/rain.svg';
import snowIcon from '@meteocons/svg/fill/snow.svg';
import thunderstormsDayHailIcon from '@meteocons/svg/fill/thunderstorms-day-hail.svg';
import thunderstormsDayIcon from '@meteocons/svg/fill/thunderstorms-day.svg';
import thunderstormsExtremeDayHailIcon from '@meteocons/svg/fill/thunderstorms-extreme-day-hail.svg';
import thunderstormsExtremeNightHailIcon from '@meteocons/svg/fill/thunderstorms-extreme-night-hail.svg';
import thunderstormsNightHailIcon from '@meteocons/svg/fill/thunderstorms-night-hail.svg';
import thunderstormsNightIcon from '@meteocons/svg/fill/thunderstorms-night.svg';

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
  0: { day: clearDayIcon, night: clearNightIcon, i18nKey: I18NKey.WmoClearSky },
  1: { day: mostlyClearDayIcon, night: mostlyClearNightIcon, i18nKey: I18NKey.WmoMainlyClear },
  2: { day: partlyCloudyDayIcon, night: partlyCloudyNightIcon, i18nKey: I18NKey.WmoPartlyCloudy },
  3: { day: overcastDayIcon, night: overcastNightIcon, i18nKey: I18NKey.WmoOvercast },
  45: { day: fogDayIcon, night: fogNightIcon, i18nKey: I18NKey.WmoFog },
  48: { day: overcastDayFogIcon, night: overcastNightFogIcon, i18nKey: I18NKey.WmoDepositingRimeFog },
  51: { day: drizzleIcon, night: drizzleIcon, i18nKey: I18NKey.WmoLightDrizzle },
  53: {
    day: overcastDayDrizzleIcon,
    night: overcastNightDrizzleIcon,
    i18nKey: I18NKey.WmoModerateDrizzle,
  },
  55: { day: extremeDayDrizzleIcon, night: extremeNightDrizzleIcon, i18nKey: I18NKey.WmoDenseDrizzle },
  56: {
    day: overcastDaySleetIcon,
    night: overcastNightSleetIcon,
    i18nKey: I18NKey.WmoLightFreezingDrizzle,
  },
  57: {
    day: extremeDaySleetIcon,
    night: extremeNightSleetIcon,
    i18nKey: I18NKey.WmoHeavyFreezingDrizzle,
  },
  61: { day: rainIcon, night: rainIcon, i18nKey: I18NKey.WmoSlightRain },
  63: { day: overcastDayRainIcon, night: overcastNightRainIcon, i18nKey: I18NKey.WmoModerateRain },
  65: { day: extremeDayRainIcon, night: extremeNightRainIcon, i18nKey: I18NKey.WmoHeavyRain },
  66: { day: overcastDaySleetIcon, night: overcastNightSleetIcon, i18nKey: I18NKey.WmoLightFreezingRain },
  67: { day: extremeDaySleetIcon, night: extremeNightSleetIcon, i18nKey: I18NKey.WmoHeavyFreezingRain },
  71: { day: snowIcon, night: snowIcon, i18nKey: I18NKey.WmoSlightSnowFall },
  73: { day: overcastDaySnowIcon, night: overcastNightSnowIcon, i18nKey: I18NKey.WmoModerateSnowFall },
  75: { day: extremeDaySnowIcon, night: extremeNightSnowIcon, i18nKey: I18NKey.WmoHeavySnowFall },
  77: { day: hailIcon, night: hailIcon, i18nKey: I18NKey.WmoSnowGrains },
  80: { day: partlyCloudyDayRainIcon, night: partlyCloudyNightRainIcon, i18nKey: I18NKey.WmoSlightRainShowers },
  81: { day: overcastDayRainIcon, night: overcastNightRainIcon, i18nKey: I18NKey.WmoModerateRainShowers },
  82: { day: extremeDayRainIcon, night: extremeNightRainIcon, i18nKey: I18NKey.WmoViolentRainShowers },
  85: { day: partlyCloudyDaySnowIcon, night: partlyCloudyNightSnowIcon, i18nKey: I18NKey.WmoSlightSnowShowers },
  86: { day: extremeDaySnowIcon, night: extremeNightSnowIcon, i18nKey: I18NKey.WmoHeavySnowShowers },
  95: { day: thunderstormsDayIcon, night: thunderstormsNightIcon, i18nKey: I18NKey.WmoThunderstorm },
  96: {
    day: thunderstormsDayHailIcon,
    night: thunderstormsNightHailIcon,
    i18nKey: I18NKey.WmoThunderstormWithSlightHail,
  },
  99: {
    day: thunderstormsExtremeDayHailIcon,
    night: thunderstormsExtremeNightHailIcon,
    i18nKey: I18NKey.WmoThunderstormWithHeavyHail,
  },
};
