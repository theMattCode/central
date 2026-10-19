import { action, affects, createOptimisticStore, refresh, type Store } from 'solid-js';
import type { FinancialAccount, FinancialAccountInput } from '@/domain/finance/accounts/model.ts';
import { useFinanceClient } from '@/domain/finance/FinanceClientContext.tsx';

export interface AccountsData {
  accounts: FinancialAccount[];
}

export interface AccountsResource {
  archive: (id: string) => Promise<void>;
  create: (input: FinancialAccountInput) => Promise<void>;
  data: Store<AccountsData>;
  /** Shows the new order of the active accounts right away; it snaps back if the backend rejects it. */
  reorder: (accountIds: string[]) => Promise<void>;
  restore: (id: string) => Promise<void>;
  update: (id: string, input: FinancialAccountInput) => Promise<void>;
}

export function useAccounts(): AccountsResource {
  const financeClient = useFinanceClient();
  const [data, setData] = createOptimisticStore<AccountsData>(
    async () => ({ accounts: await financeClient.getAccounts() }),
    { accounts: [] },
    { name: 'accounts' },
  );

  const create = action(function* (input: FinancialAccountInput) {
    affects(data);
    yield financeClient.createAccount(input);
    yield refresh(data);
  });

  const update = action(function* (id: string, input: FinancialAccountInput) {
    affects(data);
    yield financeClient.updateAccount(id, input);
    yield refresh(data);
  });

  const archive = action(function* (id: string) {
    affects(data);
    yield financeClient.archiveAccount(id);
    yield refresh(data);
  });

  const restore = action(function* (id: string) {
    affects(data);
    yield financeClient.restoreAccount(id);
    yield refresh(data);
  });

  const reorder = action(function* (accountIds: string[]) {
    affects(data);
    setData((current) => {
      const active = current.accounts.filter((account) => account.status === 'active');
      const archived = current.accounts.filter((account) => account.status === 'archived');
      const reordered = accountIds.flatMap((id) => active.filter((account) => account.id === id));
      return { accounts: [...reordered, ...archived] };
    });
    yield financeClient.reorderAccounts(accountIds);
    yield refresh(data);
  });

  return {
    archive: async (id) => void (await archive(id)),
    create: async (input) => void (await create(input)),
    data,
    reorder: async (accountIds) => void (await reorder(accountIds)),
    restore: async (id) => void (await restore(id)),
    update: async (id, input) => void (await update(id, input)),
  };
}
