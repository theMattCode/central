import { LiaArrowAltCircleUp as DirectionIcon } from 'react-icons/lia';
import type { WeatherData } from '@/widgets/weather/model/model.ts';
import { WMO_CODE_INFO } from '@/widgets/weather/model/wmo.ts';
import { TRANSLATION } from '@/i18n/translations.ts';
import type { ReactNode } from 'react';

type WeatherCurrentSummaryProps = {
  weather: WeatherData;
};

export function WeatherCurrentSummary({ weather }: WeatherCurrentSummaryProps) {
  const weatherCode = WMO_CODE_INFO[0];
  const icon = weather.current.isDay ? weatherCode.day : weatherCode.night;
  const interpretation = TRANSLATION[weatherCode.i18nKey].de;

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      <div className="flex flex-col text-center">
        <p className="text-lg font-semibold text-(--color-txt)">
          <img src={`/weather/${icon}.svg`} alt={weatherCode.i18nKey} />
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-6xl text-right font-semibold text-(--color-txt)">
          {weather.current.temperatureC.toFixed(1)} °C
        </p>
        <Detail label="" value={interpretation} />
        <Detail label="Gefühlt" value={weather.current.temperatureApparentC.toFixed(1) + ' °C'} />
        <Detail label="Luftfeuchtigkeit" value={weather.current.relativeHumidity.toFixed(0) + ' %'} />
        <Detail
          label="Wind"
          value={<WindDetails windSpeed={weather.current.windSpeed} windDirection={weather.current.windDirection} />}
        />
        <Detail label="Luftdruck" value={weather.current.pressure.toFixed(1) + ' hPa'} />
        <Detail label="Niederschlag" value={weather.current.precipitation.toFixed(1) + ' mm'} />
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | ReactNode }) {
  return (
    <div className="flex flex-row justify-between text-sm">
      <p className="text-(--color-txt-sec)">{label}</p>
      <p className="text-(--color-txt)">{value}</p>
    </div>
  );
}

function WindDetails({ windSpeed, windDirection }: { windSpeed: number; windDirection: number }) {
  return (
    <div className="flex flex-row gap-2">
      <DirectionIcon
        className="inline-block text-2xl"
        style={{
          transform: `rotate(${windDirection.toFixed(1)}deg)`,
          transformOrigin: 'center',
        }}
      />
      <p>{windSpeed.toFixed(1) + ' km/h'}</p>
    </div>
  );
}
