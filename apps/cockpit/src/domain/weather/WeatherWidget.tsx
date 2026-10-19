import { WeatherCurrentSummary } from '@/domain/weather/WeatherCurrentSummary.tsx';
import type { WeatherData, WeatherLocation } from '@/domain/weather/model/model.ts';
import { Header } from '@/domain/weather/Header.tsx';
import { useWeatherSnapshot } from '@/domain/weather/model/useWeatherSnapshot.ts';
import { Errored, Loading } from 'solid-js';

type WeatherWidgetProps = {
  location: WeatherLocation;
};

export function WeatherWidget(props: WeatherWidgetProps) {
  const weather = useWeatherSnapshot(() => props.location);

  return (
    <Errored fallback={(error, reset) => <WeatherError error={error()} onRetry={reset} />}>
      <Loading fallback={<Skeleton />} on={props.location.id}>
        <WeatherWidgetContent
          location={props.location}
          weather={weather.data()}
          isRefreshing={weather.isRefreshing()}
          onRefresh={() => void weather.refresh()}
        />
      </Loading>
    </Errored>
  );
}

type WeatherWidgetContentProps = {
  location: WeatherLocation;
  weather: WeatherData;
  isRefreshing: boolean;
  onRefresh: () => void;
};

function WeatherWidgetContent(props: WeatherWidgetContentProps) {
  return (
    <div class="flex flex-col gap-2">
      <Header location={props.location} isRefreshing={props.isRefreshing} onRefresh={props.onRefresh} />
      <WeatherCurrentSummary weather={props.weather} />
    </div>
  );
}

function WeatherError(props: { error: unknown; onRetry: () => void }) {
  return (
    <div class="flex flex-col gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
      <span>{props.error instanceof Error ? props.error.message : 'Unable to load weather.'}</span>
      <button class="self-start underline" onClick={props.onRetry} type="button">
        Retry
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <div class="w-full flex flex-col gap-2">
      <div class="flex flex-row gap-2 items-center justify-between">
        <div class="h-4 w-2/5 rounded bg-(--color-skeleton) animate-pulse" />
        <div class="h-4 w-1/10 rounded bg-(--color-skeleton) animate-pulse" />
      </div>
      <div class="flex flex-row gap-2 items-center justify-between">
        <div class="h-20 w-2/5 rounded bg-(--color-skeleton) animate-pulse" />
        <div class="w-2/5 flex flex-col gap-2">
          <div class="h-4 rounded bg-(--color-skeleton) animate-pulse" />
          <div class="h-4 rounded bg-(--color-skeleton) animate-pulse" />
          <div class="h-4 rounded bg-(--color-skeleton) animate-pulse" />
          <div class="h-4 rounded bg-(--color-skeleton) animate-pulse" />
        </div>
      </div>
    </div>
  );
}
