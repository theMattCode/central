import { cx } from '@/utils/styles.ts';
import { Section } from '@/components/Section/Section.tsx';

export function KPISection({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: number;
  unit?: string;
  tone: 'positive' | 'negative' | 'neutral';
}) {
  return (
    <Section>
      <div className="w-full h-full flex flex-col">
        <div className="text-xs uppercase text-(--color-txt-sec)">{label}</div>
        <div
          className={cx(
            'text-xl font-semibold text-center',
            tone === 'positive' ? 'text-emerald-600 dark:text-emerald-300' : undefined,
            tone === 'negative' ? 'text-rose-600 dark:text-rose-300' : undefined,
          )}
        >
          {value} {unit}
        </div>
      </div>
    </Section>
  );
}
