import { MdEdit as EditIcon } from 'react-icons/md';
import { Button } from '@/components/Button/Button.tsx';
import { Section } from '@/components/Section/Section.tsx';
import { AccountDetails, AccountIcon, AccountStatus } from '@/domain/finance/accounts/AccountPresentation.tsx';
import type { FinancialAccount } from '@/domain/finance/accounts/model.ts';

type AccountViewProps = {
  account: FinancialAccount;
  onEdit: () => void;
};

export function AccountView({ account, onEdit }: AccountViewProps) {
  return (
    <Section className="grid-section-lg">
      <div className="w-full flex items-center gap-4">
        <AccountIcon accountType={account.accountType} />
        <div className="min-w-0 grow">
          <div className="w-full flex items-start justify-between gap-2">
            <h2 className="font-semibold wrap-break-word">{account.name}</h2>
            <AccountStatus account={account} />
          </div>
          <AccountDetails accountType={account.accountType} primaryCurrencyCode={account.primaryCurrencyCode} />
        </div>
        <Button
          type="button"
          icon={EditIcon}
          shape="square"
          aria-label={`Edit ${account.name}`}
          title="Edit"
          onClick={onEdit}
        />
      </div>
    </Section>
  );
}
