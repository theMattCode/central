import { WeatherCurrentSummary } from '@/domain/weather/WeatherCurrentSummary.tsx';
import type { WeatherDataLoaded, WeatherLocation } from '@/domain/weather/model/model.ts';
import { Header } from '@/domain/weather/Header.tsx';
import { useWeatherSnapshot } from '@/domain/weather/model/useWeatherSnapshot.ts';

type WeatherWidgetProps = {
  location: WeatherLocation;
};

export function WeatherWidget({ location }: WeatherWidgetProps) {
  const weather = useWeatherSnapshot(location);

  if (weather.status === 'loading') return <Skeleton />;

  if (weather.status === 'error') return weather.errorMessage;

  return <WeatherWidgetContent location={location} weather={weather} />;
}

type WeatherWidgetContentProps = {
  location: WeatherLocation;
  weather: WeatherDataLoaded;
};

function WeatherWidgetContent({ location, weather }: WeatherWidgetContentProps) {
  return (
    <div className="flex flex-col gap-2">
      <Header location={location} data={weather} />
      <WeatherCurrentSummary weather={weather.weatherData} />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex flex-row gap-2 items-center justify-between">
        <div className="h-4 w-2/5 rounded bg-(--color-skeleton) animate-pulse" />
        <div className="h-4 w-1/10 rounded bg-(--color-skeleton) animate-pulse" />
      </div>
      <div className="flex flex-row gap-2 items-center justify-between">
        <div className="h-20 w-2/5 rounded bg-(--color-skeleton) animate-pulse" />
        <div className="w-2/5 flex flex-col gap-2">
          <div className="h-4 rounded bg-(--color-skeleton) animate-pulse" />
          <div className="h-4 rounded bg-(--color-skeleton) animate-pulse" />
          <div className="h-4 rounded bg-(--color-skeleton) animate-pulse" />
          <div className="h-4 rounded bg-(--color-skeleton) animate-pulse" />
        </div>
      </div>
    </div>
  );
}
