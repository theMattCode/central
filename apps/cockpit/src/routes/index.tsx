import { createFileRoute } from '@tanstack/react-router';
import { WeatherWidget } from '@/widgets/weather/WeatherWidget.tsx';

export const Route = createFileRoute('/')({ component: App });

function App() {
  return (
    <>
      <WeatherWidget />
    </>
  );
}
