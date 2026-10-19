import { Section } from '@/components/Section/Section.tsx';

interface Props {
  label: string;
  value: string;
  tone: 'positive' | 'negative' | 'neutral';
}

export function KPISection(props: Props) {
  return (
    <Section class="col-span-1">
      <div class="w-full h-full flex flex-col gap-1 text-center">
        <div class="text-xs text-(--color-txt-sec) uppercase">{props.label}</div>
        <div
          class={[
            'text-xl font-semibold',
            {
              'text-(--color-sem-positive)': props.tone === 'positive',
              'text-(--color-sem-negative)': props.tone === 'negative',
            },
          ]}
        >
          {props.value}
        </div>
      </div>
    </Section>
  );
}
