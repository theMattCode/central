import { useEffect, useState } from 'react';
import { useFinanceClient } from '@/domain/finance/FinanceClientContext.tsx';
import type { FinancialAccount } from '@/domain/finance/accounts/model.ts';
import { toErrorMessage } from '@/utils/formatting.ts';

interface Error {
  source: unknown;
  message: string;
}

interface ComputedData {
  accounts: FinancialAccount[];
  activeAccounts: FinancialAccount[];
  archivedAccounts: FinancialAccount[];
}

interface Accounts {
  data: ComputedData | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

export function useFinancialAccounts(): Accounts {
  const financeClient = useFinanceClient();
  const [reloadVersion, setReloadVersion] = useState(0);
  const [accounts, setAccounts] = useState<Accounts>({
    data: null,
    error: null,
    loading: true,
    reload: () => setReloadVersion((version) => version + 1),
  });

  useEffect(() => {
    const abortController = new AbortController();

    const loadAccounts = async () => {
      try {
        setAccounts((prev) => ({ ...prev, loading: true }));
        const response = await financeClient.getAccounts({ signal: abortController.signal });
        setAccounts((prev) => ({
          ...prev,
          loading: false,
          error: null,
          data: {
            accounts: response.accounts,
            activeAccounts: response.accounts.filter((account) => account.status === 'active'),
            archivedAccounts: response.accounts.filter((account) => account.status === 'archived'),
          },
        }));
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        setAccounts((prev) => ({
          ...prev,
          loading: false,
          error: { source: error, message: toErrorMessage(error) },
        }));
      }
    };

    void loadAccounts();

    return () => abortController.abort();
  }, [financeClient, reloadVersion]);

  return accounts;
}
