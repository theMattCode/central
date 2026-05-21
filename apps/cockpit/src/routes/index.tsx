import { createFileRoute } from '@tanstack/react-router';
import { WeatherWidget } from '@/components/organisms/weather/WeatherWidget.tsx';
import { LOCATION_MOESSINGEN, LOCATION_OBERNHEIM } from '@/components/organisms/weather/model/model.ts';

export const Route = createFileRoute('/')({
  component: App,
});

function App() {
  return (
    <>
      <WeatherWidget location={LOCATION_MOESSINGEN} />
      <WeatherWidget location={LOCATION_OBERNHEIM} />
      {/*<VoiceWidget />*/}
    </>
  );
}
