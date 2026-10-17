import { describe, expect, it } from 'vitest';
import { createEmptyTransactionFormState, toCashTransactionInput } from '@/domain/finance/transactions/model.ts';
import { getTransactionURL, validateTransactionInput } from '@/domain/finance/transactions/api.ts';

describe('toCashTransactionInput', () => {
  it('includes the selected financial account', () => {
    const input = toCashTransactionInput({
      ...createEmptyTransactionFormState('2026-10-17'),
      amount: ' 12.50 ',
      description: ' Groceries ',
      financialAccountId: 'giro',
    });

    expect(input).toEqual({
      direction: 'expense',
      transactionDate: '2026-10-17',
      amount: '12.50',
      description: 'Groceries',
      category: undefined,
      note: undefined,
      financialAccountId: 'giro',
    });
  });
});

describe('validateTransactionInput', () => {
  const valid = {
    direction: 'income',
    transactionDate: '2026-10-17',
    amount: '10.00',
    description: 'Salary',
    financialAccountId: 'giro',
  };

  it('keeps the financial account', () => {
    expect(validateTransactionInput(valid)).toMatchObject({ financialAccountId: 'giro' });
  });

  it.each([
    ['a missing account', { ...valid, financialAccountId: undefined }],
    ['an empty account', { ...valid, financialAccountId: '' }],
  ])('rejects %s', (_label, input) => {
    expect(() => validateTransactionInput(input)).toThrow('Invalid cash transaction payload.');
  });
});

describe('getTransactionURL', () => {
  it('addresses a single transaction by id', () => {
    expect(getTransactionURL('0193 abc').pathname).toBe('/api/v1/finance/transactions/0193%20abc');
  });
});
