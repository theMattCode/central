import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/atoms/Button/Button.tsx';
import { LuAlarmClockPlus, LuPencil } from 'react-icons/lu';

export const Route = createFileRoute('/components')({
  component: Components,
  head: () => ({
    meta: [{ title: 'Central Dashboard | Components' }],
  }),
});

function Components() {
  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="flex flex-row gap-2">
        <Button text="Hello World" />
        <Button text="Hello World" icon={LuAlarmClockPlus} />
        <Button icon={LuPencil} />
      </div>
      <div className="flex flex-row gap-2">
        <Button icon={LuPencil} shape="circle" />
      </div>
    </div>
  );
}
