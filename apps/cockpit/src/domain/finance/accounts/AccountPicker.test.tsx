/* @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AccountPicker } from '@/domain/finance/accounts/AccountPicker.tsx';
import type { FinancialAccount } from '@/domain/finance/accounts/model.ts';

function createAccount(partial: Partial<FinancialAccount> & Pick<FinancialAccount, 'id' | 'name'>): FinancialAccount {
  return {
    id: partial.id,
    name: partial.name,
    accountType: partial.accountType ?? 'bank',
    primaryCurrencyCode: partial.primaryCurrencyCode ?? 'EUR',
    displayOrder: partial.displayOrder ?? 0,
    status: partial.status ?? 'active',
    archivedAt: partial.archivedAt ?? null,
    createdAt: '2026-10-17T10:00:00Z',
    updatedAt: '2026-10-17T10:00:00Z',
  };
}

const ACCOUNTS = [
  createAccount({ id: 'giro', name: 'Girokonto' }),
  createAccount({ id: 'old', name: 'Old wallet', status: 'archived', archivedAt: '2026-10-01T10:00:00Z' }),
  createAccount({ id: 'usd', name: 'Dollar account', primaryCurrencyCode: 'USD' }),
  createAccount({ id: 'cash', name: 'Wallet', accountType: 'cash' }),
];

function optionLabels() {
  return within(screen.getByLabelText('Account'))
    .getAllByRole('option')
    .map((option) => option.textContent);
}

describe('AccountPicker', () => {
  const user = userEvent.setup();

  it('offers only active EUR accounts in list order', () => {
    render(<AccountPicker currencyCode="EUR" accounts={ACCOUNTS} value="" onChange={() => {}} />);

    expect(optionLabels()).toEqual(['Select an account', 'Girokonto', 'Wallet']);
  });

  it('requires a selection', () => {
    render(<AccountPicker currencyCode="EUR" accounts={ACCOUNTS} value="" onChange={() => {}} />);

    expect((screen.getByLabelText('Account') as HTMLSelectElement).required).toBe(true);
  });

  it('keeps an assigned archived account selectable and marks it', () => {
    render(<AccountPicker currencyCode="EUR" accounts={ACCOUNTS} value="old" onChange={() => {}} />);

    expect(optionLabels()).toEqual(['Select an account', 'Old wallet (archived)', 'Girokonto', 'Wallet']);
    expect((screen.getByLabelText('Account') as HTMLSelectElement).value).toBe('old');
  });

  it('reports the selected account id', async () => {
    const onChange = vi.fn();
    render(<AccountPicker currencyCode="EUR" accounts={ACCOUNTS} value="" onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText('Account'), 'cash');

    expect(onChange).toHaveBeenCalledWith('cash');
  });

  it('links to account management when no account can be selected', () => {
    render(<AccountPicker currencyCode="EUR" accounts={[ACCOUNTS[1], ACCOUNTS[2]]} value="" onChange={() => {}} />);

    expect(screen.queryByLabelText('Account')).toBeNull();
    expect(screen.getByRole('link', { name: 'Create an account' }).getAttribute('href')).toBe('/finance/accounts');
  });

  it('shows a disabled select while accounts are loading', () => {
    render(<AccountPicker currencyCode="EUR" accounts={null} value="" onChange={() => {}} />);

    expect((screen.getByLabelText('Account') as HTMLSelectElement).disabled).toBe(true);
    expect(optionLabels()).toEqual(['Loading accounts...']);
    expect(screen.queryByRole('link', { name: 'Create an account' })).toBeNull();
  });

  it('shows why accounts are missing when loading failed', () => {
    render(
      <AccountPicker currencyCode="EUR" accounts={null} error="backend unavailable" value="" onChange={() => {}} />,
    );

    expect(screen.getByRole('alert').textContent).toBe('Accounts could not be loaded: backend unavailable');
    expect((screen.getByLabelText('Account') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByRole('link', { name: 'Create an account' })).toBeNull();
  });
});
