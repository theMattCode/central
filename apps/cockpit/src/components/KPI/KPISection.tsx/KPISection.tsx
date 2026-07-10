import { cx } from '@/utils/styles.ts';
import { Section } from '@/components/Section/Section.tsx';

interface Props {
  label: string;
  value: string;
  tone: 'positive' | 'negative' | 'neutral';
}

export function KPISection({ label, value, tone }: Props) {
  return (
    <Section className="grid-section-xs">
      <div className="w-full h-full flex flex-col gap-1 text-center">
        <div className="text-xs text-(--color-txt-sec) uppercase">{label}</div>
        <div
          className={cx(
            'text-xl font-semibold',
            tone === 'positive' ? 'text-(--color-sem-positive)' : undefined,
            tone === 'negative' ? 'text-(--color-sem-negative)' : undefined,
          )}
        >
          {value}
        </div>
      </div>
    </Section>
  );
}
