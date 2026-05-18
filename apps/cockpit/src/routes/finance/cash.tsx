import { createFileRoute } from '@tanstack/react-router';
import { CashPage } from '@/widgets/finance/cash/components/CashPage.tsx';

export const Route = createFileRoute('/finance/cash')({
  component: CashRoute,
});

function CashRoute() {
  return <CashPage />;
}
