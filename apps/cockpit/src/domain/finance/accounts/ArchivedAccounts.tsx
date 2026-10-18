import { useState } from 'react';
import { MdExpandLess as CollapseIcon, MdExpandMore as ExpandIcon, MdUnarchive as RestoreIcon } from 'react-icons/md';
import { Button } from '@/components/Button/Button.tsx';
import { Section } from '@/components/Section/Section.tsx';
import { AccountSummary } from '@/domain/finance/accounts/AccountSummary.tsx';
import type { FinancialAccount } from '@/domain/finance/accounts/model.ts';

type Props = {
  accounts: FinancialAccount[];
  onRestore: (account: FinancialAccount) => void;
};

/** Archived accounts stay visible for reference but can only be restored. Collapsed by default. */
export function ArchivedAccounts({ accounts, onRestore }: Props) {
  const [expanded, setExpanded] = useState(false);
  const ToggleIcon = expanded ? CollapseIcon : ExpandIcon;

  return (
    <Section className="col-span-full">
      <button
        type="button"
        aria-expanded={expanded}
        className="w-full flex items-center justify-between text-sm text-(--color-txt-sec)"
        onClick={() => setExpanded((value) => !value)}
      >
        <span>Archived ({accounts.length})</span>
        <ToggleIcon aria-hidden className="h-5 w-5" />
      </button>
      {expanded && (
        <ul aria-label="Archived accounts" className="w-full flex flex-col divide-y divide-(--color-section-border)">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-center gap-3 py-2 opacity-70">
              <AccountSummary account={account} />
              <Button
                type="button"
                aria-label={`Restore ${account.name}`}
                title="Restore"
                icon={RestoreIcon}
                onClick={() => onRestore(account)}
              />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
