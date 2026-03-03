import { Suspense } from 'react';
import { Section } from '@/components/Section/Section.tsx';

export function WeatherWidget() {
  return (
    <Section>
      <Suspense>Weather</Suspense>
    </Section>
  );
}
