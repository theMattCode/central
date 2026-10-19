import type { WeatherData } from '@/domain/weather/model/model.ts';
import { WMO_CODE_MAP } from '@/domain/weather/model/wmo.ts';
import { TRANSLATION } from '@/i18n/translations.ts';
import type { JSX } from '@solidjs/web';
import { Icon } from '@/components/Icon/Icon.tsx';
import { WindDirectionIcon } from '@/components/Icon/OriginalIcons.tsx';

type WeatherCurrentSummaryProps = {
  weather: WeatherData;
};

export function WeatherCurrentSummary(props: WeatherCurrentSummaryProps) {
  const weatherCode = () => WMO_CODE_MAP[props.weather.current.weatherCode] ?? WMO_CODE_MAP[0];
  const icon = () => (props.weather.current.isDay ? weatherCode().day : weatherCode().night);
  const interpretation = () => TRANSLATION[weatherCode().i18nKey].de;

  return (
    <div class="flex flex-row gap-4">
      <img src={icon()} alt={weatherCode().i18nKey} class="h-40 text-(--color-txt)" />
      <div class="flex flex-col grow gap-0.5">
        <span class="text-4xl text-right font-semibold text-(--color-txt)">
          {props.weather.current.temperatureC.toFixed(1)} °C
        </span>
        <Detail label="" value={interpretation()} />
        <Detail label="Gefühlt" value={props.weather.current.temperatureApparentC.toFixed(1) + ' °C'} />
        <Detail
          label="Wind"
          value={
            <WindDetails
              windSpeed={props.weather.current.windSpeed}
              windDirection={props.weather.current.windDirection}
            />
          }
        />
        <Detail label="Luftfeuchtigkeit" value={props.weather.current.relativeHumidity.toFixed(0) + ' %'} />
        <Detail label="Luftdruck" value={props.weather.current.pressure.toFixed(1) + ' hPa'} />
        <Detail label="Niederschlag" value={props.weather.current.precipitation.toFixed(1) + ' mm'} />
      </div>
    </div>
  );
}

function Detail(props: { label: string; value: string | JSX.Element }) {
  return (
    <div class="flex flex-row justify-between text-sm gap-4">
      <span class="text-(--color-txt-sec)">{props.label}</span>
      <span class="text-(--color-txt)">{props.value}</span>
    </div>
  );
}

function WindDetails(props: { windSpeed: number; windDirection: number }) {
  return (
    <div class="flex flex-row gap-2">
      <Icon
        icon={WindDirectionIcon}
        class="inline-flex h-5 w-5 text-xl"
        style={{
          transform: `rotate(${props.windDirection.toFixed(1)}deg)`,
          'transform-origin': 'center',
        }}
      />
      <span class="text-(--color-txt)">{props.windSpeed.toFixed(1) + ' km/h'}</span>
    </div>
  );
}
