import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/Button/Button.tsx';
import { ButtonGroup } from '@/components/ButtonGroup/ButtonGroup.tsx';
import { LuAlarmClockPlus, LuPencil } from 'react-icons/lu';

export const Route = createFileRoute('/components')({
  component: Components,
  head: () => ({
    meta: [{ title: 'Central Dashboard | Components' }],
  }),
});

function Components() {
  return (
    <div className="w-full h-full flex flex-col gap-6 p-6">
      <ShowcaseButtons />

      <ShowcaseButtonGroup />
    </div>
  );
}

function ShowcaseButtons() {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-lg font-bold">Buttons</h3>
      <div className="flex flex-row gap-2">
        <Button name="hello" text="Hello World" />
        <Button name="alarm" text="Hello World" icon={LuAlarmClockPlus} />
        <Button name="pencil" icon={LuPencil} />
      </div>
      <div className="flex flex-row gap-2">
        <Button name="pencil-circle" icon={LuPencil} shape="circle" />
      </div>
    </div>
  );
}

function ShowcaseButtonGroup() {
  const options = [
    {
      id: '1',
      text: 'Daily',
      style: { optionColor: 'var(--color-sem-positive)' },
    },
    {
      id: '2',
      text: 'Weekly',
      style: { optionColor: 'var(--color-sem-neutral)' },
    },
    {
      id: '3',
      text: 'Monthly',
      style: { optionColor: 'var(--color-sem-negative)' },
    },
  ];
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-lg font-bold">Button Group</h3>
      <ButtonGroup
        options={options}
        defaultValue={options[0]}
        onChanged={(opt) => console.log('Selected:', opt)}
      />
    </div>
  );
}
