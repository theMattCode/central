import { createFileRoute } from '@tanstack/react-router';
import { WeatherWidget } from '@/domain/weather/WeatherWidget.tsx';
import { LOCATION_MOESSINGEN, LOCATION_OBERNHEIM } from '@/domain/weather/model/model.ts';
import { GridLayout } from '@/components/ContentLayout/GridLayout.tsx';

export const Route = createFileRoute('/')({
  component: App,
});

function App() {
  return (
    <GridLayout>
      <WeatherWidget location={LOCATION_MOESSINGEN} />
      <WeatherWidget location={LOCATION_OBERNHEIM} />
      {/*
      <VoiceWidget />
      */}
    </GridLayout>
  );
}
