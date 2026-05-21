import { LiaArrowAltCircleUp as DirectionIcon } from 'react-icons/lia';
import type { WeatherData } from '@/components/organisms/weather/model/model.ts';
import { WMO_CODE_MAP } from '@/components/organisms/weather/model/wmo.ts';
import { TRANSLATION } from '@/i18n/translations.ts';
import type { ReactNode } from 'react';

type WeatherCurrentSummaryProps = {
  weather: WeatherData;
};

export function WeatherCurrentSummary({ weather }: WeatherCurrentSummaryProps) {
  const weatherCode = WMO_CODE_MAP[weather.current.weatherCode] ?? WMO_CODE_MAP[0];
  const icon = weather.current.isDay ? weatherCode.day : weatherCode.night;
  const interpretation = TRANSLATION[weatherCode.i18nKey].de;

  return (
    <div className="flex flex-row gap-4">
      <img src={icon} alt={weatherCode.i18nKey} className="h-40 text-(--color-txt)" />
      <div className="flex flex-col grow gap-0.5">
        <span className="text-4xl text-right font-semibold text-(--color-txt)">
          {weather.current.temperatureC.toFixed(1)} °C
        </span>
        <Detail label="" value={interpretation} />
        <Detail label="Gefühlt" value={weather.current.temperatureApparentC.toFixed(1) + ' °C'} />
        <Detail
          label="Wind"
          value={<WindDetails windSpeed={weather.current.windSpeed} windDirection={weather.current.windDirection} />}
        />
        <Detail label="Luftfeuchtigkeit" value={weather.current.relativeHumidity.toFixed(0) + ' %'} />
        <Detail label="Luftdruck" value={weather.current.pressure.toFixed(1) + ' hPa'} />
        <Detail label="Niederschlag" value={weather.current.precipitation.toFixed(1) + ' mm'} />
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | ReactNode }) {
  return (
    <div className="flex flex-row justify-between text-sm gap-4">
      <span className="text-(--color-txt-sec)">{label}</span>
      <span className="text-(--color-txt)">{value}</span>
    </div>
  );
}

function WindDetails({ windSpeed, windDirection }: { windSpeed: number; windDirection: number }) {
  return (
    <div className="flex flex-row gap-2">
      <DirectionIcon
        className="inline-block text-xl"
        style={{
          transform: `rotate(${windDirection.toFixed(1)}deg)`,
          transformOrigin: 'center',
        }}
      />
      <span className="text-(--color-txt)">{windSpeed.toFixed(1) + ' km/h'}</span>
    </div>
  );
}
