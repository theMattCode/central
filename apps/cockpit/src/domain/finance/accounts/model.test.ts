import { describe, expect, it } from 'vitest';
import { validateFinancialAccountInput } from '@/domain/finance/accounts/model.ts';

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
