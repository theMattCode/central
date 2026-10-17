import { describe, expect, it } from 'vitest';
import {
  validateFinancialAccountIdInput,
  validateFinancialAccountInput,
  validateUpdateFinancialAccountInput,
} from '@/domain/finance/accounts/model.ts';

describe('validateFinancialAccountInput', () => {
  it('accepts every account type', () => {
    for (const accountType of ['cash', 'bank', 'credit', 'loan', 'investment']) {
      expect(validateFinancialAccountInput({ name: 'Depot', accountType, primaryCurrencyCode: 'EUR' })).toEqual({
        name: 'Depot',
        accountType,
        primaryCurrencyCode: 'EUR',
      });
    }
  });

  it('drops unknown fields', () => {
    expect(
      validateFinancialAccountInput({ name: 'Depot', accountType: 'bank', primaryCurrencyCode: 'EUR', status: 'x' }),
    ).toEqual({ name: 'Depot', accountType: 'bank', primaryCurrencyCode: 'EUR' });
  });

  it.each([
    ['null', null],
    ['a string', 'Depot'],
    ['a missing name', { accountType: 'bank', primaryCurrencyCode: 'EUR' }],
    ['an unknown account type', { name: 'Depot', accountType: 'savings', primaryCurrencyCode: 'EUR' }],
    ['a non-string currency', { name: 'Depot', accountType: 'bank', primaryCurrencyCode: 978 }],
  ])('rejects %s', (_label, input) => {
    expect(() => validateFinancialAccountInput(input)).toThrow('Invalid financial account payload.');
  });
});

describe('validateUpdateFinancialAccountInput', () => {
  const account = { name: 'Depot', accountType: 'investment', primaryCurrencyCode: 'EUR' };

  it('accepts an id with a valid account', () => {
    expect(validateUpdateFinancialAccountInput({ id: 'depot', account })).toEqual({ id: 'depot', account });
  });

  it.each([
    ['null', null],
    ['a missing id', { account }],
    ['an empty id', { id: '', account }],
    ['an invalid account', { id: 'depot', account: { ...account, accountType: 'savings' } }],
  ])('rejects %s', (_label, input) => {
    expect(() => validateUpdateFinancialAccountInput(input)).toThrow('Invalid financial account payload.');
  });
});

describe('validateFinancialAccountIdInput', () => {
  it('keeps only the id', () => {
    expect(validateFinancialAccountIdInput({ id: 'depot', extra: true })).toEqual({ id: 'depot' });
  });

  it.each([
    ['null', null],
    ['a missing id', {}],
    ['an empty id', { id: '' }],
    ['a numeric id', { id: 42 }],
  ])('rejects %s', (_label, input) => {
    expect(() => validateFinancialAccountIdInput(input)).toThrow('Invalid financial account payload.');
  });
});
