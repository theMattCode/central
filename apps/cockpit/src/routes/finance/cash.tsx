import { createFileRoute } from '@tanstack/react-router';
import { CashPage } from '@/components/organisms/finance/cash/CashPage.tsx';

export const Route = createFileRoute('/finance/cash')({
  component: CashRoute,
});

function CashRoute() {
  return <CashPage />;
}
