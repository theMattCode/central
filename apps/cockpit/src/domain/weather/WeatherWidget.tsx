import { WeatherCurrentSummary } from '@/domain/weather/WeatherCurrentSummary.tsx';
import type { WeatherDataLoaded, WeatherLocation } from '@/domain/weather/model/model.ts';
import { Header } from '@/domain/weather/Header.tsx';
import { useWeatherSnapshot } from '@/domain/weather/model/useWeatherSnapshot.ts';
import { FadeTransition } from '@/components/Transition/FadeTransition.tsx';

type WeatherWidgetProps = {
  location: WeatherLocation;
};

export function WeatherWidget({ location }: WeatherWidgetProps) {
  const weather = useWeatherSnapshot(location);

  return (
    <FadeTransition transitionKey={weather.status}>
      {weather.status === 'loading' && <Skeleton />}
      {weather.status === 'error' && weather.errorMessage}
      {weather.status === 'loaded' && <WeatherWidgetContent location={location} weather={weather} />}
    </FadeTransition>
  );
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
        <div className="h-4 w-1/3 rounded bg-(--color-skeleton) animate-pulse" />
        <div className="h-4 w-1/10 rounded bg-(--color-skeleton) animate-pulse" />
      </div>
      <div className="flex flex-row gap-2 items-center justify-between">
        <div className="h-20 w-1/3 rounded bg-(--color-skeleton) animate-pulse" />
        <div className="w-1/3 flex flex-col gap-2">
          <div className="h-4 rounded bg-(--color-skeleton) animate-pulse" />
          <div className="h-4 rounded bg-(--color-skeleton) animate-pulse" />
          <div className="h-4 rounded bg-(--color-skeleton) animate-pulse" />
          <div className="h-4 rounded bg-(--color-skeleton) animate-pulse" />
        </div>
      </div>
    </div>
  );
}
