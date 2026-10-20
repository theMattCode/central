import { createFileRoute } from '@tanstack/solid-router';
import { WeatherWidget } from '@/domain/weather/WeatherWidget.tsx';
import { LOCATION_MOESSINGEN, LOCATION_OBERNHEIM, LOCATION_TUEBINGEN } from '@/domain/weather/model/model.ts';
import { GridLayout } from '@/components/GridLayout/GridLayout.tsx';
import { Section } from '@/components/Section/Section.tsx';

export const Route = createFileRoute('/')({
  component: Overview,
});

function Overview() {
  return (
    <GridLayout>
      <Section class="col-span-2 md:col-span-2 lg:col-span-2 2xl:col-span-2">
        <WeatherWidget location={LOCATION_MOESSINGEN} />
      </Section>
      <Section class="col-span-2 md:col-span-2 lg:col-span-2 2xl:col-span-2">
        <WeatherWidget location={LOCATION_OBERNHEIM} />
      </Section>
      <Section class="col-span-2 md:col-span-2 lg:col-span-2 2xl:col-span-2">
        <WeatherWidget location={LOCATION_TUEBINGEN} />
      </Section>
    </GridLayout>
  );
}
