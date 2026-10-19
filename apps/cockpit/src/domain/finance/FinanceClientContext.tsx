import { createContext, type ParentProps, useContext } from 'solid-js';
import type { FinanceClient } from '@/domain/finance/financeClient.ts';

const FinanceClientContext = createContext<FinanceClient>();

export function FinanceClientProvider(props: ParentProps<{ client: FinanceClient }>) {
  return <FinanceClientContext value={props.client}>{props.children}</FinanceClientContext>;
}

export function useFinanceClient(): FinanceClient {
  return useContext(FinanceClientContext);
}
