import { createContext, type PropsWithChildren, useContext } from 'react';
import {
  DEFAULT_FINANCE_CLIENT,
  type FinanceClient,
} from '@/domain/finance/financeClient.ts';

const FinanceClientContext = createContext<FinanceClient>(
  DEFAULT_FINANCE_CLIENT,
);

export function FinanceClientProvider({
  children,
  client,
}: PropsWithChildren<{ client: FinanceClient }>) {
  return (
    <FinanceClientContext.Provider value={client}>
      {children}
    </FinanceClientContext.Provider>
  );
}

export function useFinanceClient(): FinanceClient {
  return useContext(FinanceClientContext);
}
