import { createFileRoute } from '@tanstack/solid-router';
import { Button } from '@/components/Button/Button.tsx';
import { ButtonGroup } from '@/components/ButtonGroup/ButtonGroup.tsx';
import { AlarmClockPlusIcon, PencilIcon } from '@/components/Icon/OriginalIcons.tsx';

export const Route = createFileRoute('/components')({
  component: Components,
  head: () => ({
    meta: [{ title: 'Central Dashboard | Components' }],
  }),
});

function Components() {
  return (
    <div class="w-full h-full flex flex-col gap-6 p-6">
      <ShowcaseButtons />

      <ShowcaseButtonGroup />
    </div>
  );
}

function ShowcaseButtons() {
  return (
    <div class="flex flex-col gap-2">
      <h3 class="text-lg font-bold">Buttons</h3>
      <div class="flex flex-row gap-2">
        <Button name="hello" text="Hello World" />
        <Button name="alarm" text="Hello World" icon={AlarmClockPlusIcon} />
        <Button name="pencil" icon={PencilIcon} />
      </div>
      <div class="flex flex-row gap-2">
        <Button name="pencil-circle" icon={PencilIcon} shape="circle" />
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
    <div class="flex flex-col gap-2">
      <h3 class="text-lg font-bold">Button Group</h3>
      <ButtonGroup options={options} defaultValue={options[0]} onChanged={(opt) => console.log('Selected:', opt)} />
    </div>
  );
}
