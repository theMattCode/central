import { describe, expect, it } from 'vitest';
import { getBreadcrumbItems } from '@/components/ContentLayout/ContentLayout.tsx';

describe('getBreadcrumbItems', () => {
  it('returns the Jarvis breadcrumb for the Jarvis route', () => {
    expect(getBreadcrumbItems('/jarvis')).toEqual(['Home', 'Jarvis']);
  });

  it('returns the finance cash breadcrumb for the cash route', () => {
    expect(getBreadcrumbItems('/finance/cash')).toEqual([
      'Home',
      'Finance',
      'Cash',
    ]);
  });

  it('falls back to the overview breadcrumb for unknown routes', () => {
    expect(getBreadcrumbItems('/unknown')).toEqual(['Home', 'Dashboard']);
  });
});
