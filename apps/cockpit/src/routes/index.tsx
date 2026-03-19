import { createFileRoute } from '@tanstack/react-router';
import { VoiceWidget } from '@/widgets/voice/components/VoiceWidget.tsx';
import { WeatherWidget } from '@/widgets/weather/components/WeatherWidget.tsx';
import { LOCATION_MOESSINGEN, LOCATION_OBERNHEIM } from '@/widgets/weather/model/model.ts';

export const Route = createFileRoute('/')({
  component: App,
});

function App() {
  return (
    <>
      <VoiceWidget />
      <WeatherWidget location={LOCATION_MOESSINGEN} />
      <WeatherWidget location={LOCATION_OBERNHEIM} />
    </>
  );
}
