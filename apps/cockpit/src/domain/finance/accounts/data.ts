import { useEffect, useState } from 'react';
import type { FinancialAccount } from '@/domain/finance/accounts/model.ts';
import { useFinanceClient } from '@/domain/finance/FinanceClientContext.tsx';
import { toErrorMessage } from '@/utils/formatting.ts';

interface Accounts {
  accounts: FinancialAccount[] | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useAccounts(): Accounts {
  const financeClient = useFinanceClient();
  const [reloadVersion, setReloadVersion] = useState(0);
  const [state, setState] = useState<Omit<Accounts, 'reload'>>({ accounts: null, error: null, loading: true });

  useEffect(() => {
    const abortController = new AbortController();

    const loadAccounts = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true }));
        const accounts = await financeClient.getAccounts({ signal: abortController.signal });
        setState({ accounts, error: null, loading: false });
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        setState((prev) => ({ ...prev, loading: false, error: toErrorMessage(error) }));
      }
    };

    void loadAccounts();

    return () => abortController.abort();
  }, [financeClient, reloadVersion]);

  return { ...state, reload: () => setReloadVersion((version) => version + 1) };
}
