import { FadeTransition } from '@/components/Transition/FadeTransition.tsx';
import { Section } from '@/components/Section/Section.tsx';
import { WeatherCurrentSummary } from '@/widgets/weather/components/WeatherCurrentSummary.tsx';
import type { WeatherDataLoaded, WeatherLocation } from '@/widgets/weather/model/model.ts';
import { Header } from '@/widgets/weather/components/Header.tsx';
import { useWeatherSnapshot } from '@/widgets/weather/model/useWeatherSnapshot.ts';

type WeatherWidgetProps = {
  location: WeatherLocation;
};

export function WeatherWidget({ location }: WeatherWidgetProps) {
  const weather = useWeatherSnapshot(location);

  return (
    <FadeTransition transitionKey={weather.status}>
      {weather.status === 'error' && <Section>{weather.errorMessage}</Section>}
      {weather.status === 'loaded' && (
        <Section>
          <WeatherWidgetContent location={location} weather={weather} />
        </Section>
      )}
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
