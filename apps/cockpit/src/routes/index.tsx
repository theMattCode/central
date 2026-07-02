import { createFileRoute } from '@tanstack/react-router';
import { WeatherWidget } from '@/domain/weather/WeatherWidget.tsx';
import { LOCATION_MOESSINGEN, LOCATION_OBERNHEIM, LOCATION_TUEBINGEN } from '@/domain/weather/model/model.ts';
import { GridLayout } from '@/components/ContentLayout/GridLayout.tsx';
import { Section } from '@/components/Section/Section.tsx';

export const Route = createFileRoute('/')({
  component: Overview,
});

function Overview() {
  return (
    <GridLayout>
      <Section className="col-span-1 md:col-span-2 lg:col-span-2 2xl:col-span-2">
        <WeatherWidget location={LOCATION_MOESSINGEN} />
      </Section>
      <Section className="col-span-1 md:col-span-2 lg:col-span-2 2xl:col-span-2">
        <WeatherWidget location={LOCATION_OBERNHEIM} />
      </Section>
      <Section className="col-span-1 md:col-span-2 lg:col-span-2 2xl:col-span-2">
        <WeatherWidget location={LOCATION_TUEBINGEN} />
      </Section>
    </GridLayout>
  );
}
