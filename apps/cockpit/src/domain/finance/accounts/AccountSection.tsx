import { useEffect, useState } from 'react';
import { useFinanceClient } from '@/domain/finance/FinanceClientContext.tsx';
import { AccountEditor } from '@/domain/finance/accounts/AccountEditor.tsx';
import { AccountView } from '@/domain/finance/accounts/AccountView.tsx';
import {
  toFinancialAccountCreateInput,
  toFinancialAccountUpdateInput,
  type FinancialAccount,
  type FinancialAccountFormState,
} from '@/domain/finance/accounts/model.ts';

type AccountSectionProps = {
  account: FinancialAccount | null;
  onCreated?: (account: FinancialAccount) => void;
  onDiscardDraft?: () => void;
  onEditingChange: (isEditing: boolean) => void;
  onSaved: () => void;
  shouldFocusName?: boolean;
};

export function AccountSection({
  account: initialAccount,
  onCreated,
  onDiscardDraft,
  onEditingChange,
  onSaved,
  shouldFocusName = false,
}: AccountSectionProps) {
  const financeClient = useFinanceClient();
  const [account, setAccount] = useState<FinancialAccount | null>(initialAccount);
  const [mode, setMode] = useState<'view' | 'edit'>(initialAccount ? 'view' : 'edit');

  useEffect(() => {
    if (initialAccount && mode === 'view') {
      setAccount(initialAccount);
    }
  }, [initialAccount, mode]);

  const beginEditing = () => {
    if (!account) {
      return;
    }
    setMode('edit');
    onEditingChange(true);
  };

  const cancelEditing = () => {
    if (!account) {
      onDiscardDraft?.();
      return;
    }
    setMode('view');
    onEditingChange(false);
  };

  const save = async (form: FinancialAccountFormState) => {
    const savedAccount = account
      ? await financeClient.updateAccount(toFinancialAccountUpdateInput(account, form))
      : await financeClient.createAccount(toFinancialAccountCreateInput(form));
    const wasNew = !account;
    setAccount(savedAccount);
    setMode('view');
    onEditingChange(false);
    if (wasNew) {
      onCreated?.(savedAccount);
    } else {
      onSaved();
    }
  };

  if (mode === 'view' && account) {
    return <AccountView account={account} onEdit={beginEditing} />;
  }

  return (
    <AccountEditor
      key={account?.id ?? 'new'}
      account={account}
      onCancel={cancelEditing}
      onSubmit={save}
      shouldFocusName={shouldFocusName}
    />
  );
}
