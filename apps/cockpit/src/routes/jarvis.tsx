import { createFileRoute } from '@tanstack/react-router';
import { Jarvis } from '@/domain/assistant/Jarvis/Jarvis.tsx';

export const Route = createFileRoute('/jarvis')({
  component: JarvisRoute,
  head: () => ({
    meta: [{ title: 'Central Dashboard | Jarvis' }],
  }),
});

function JarvisRoute() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <Jarvis />
    </div>
  );
}
