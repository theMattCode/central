import { describe, expect, it } from 'vitest';
import { getBreadcrumbItems } from '@/components/Layout/ContentLayout';

describe('getBreadcrumbItems', () => {
  it('returns the Jarvis breadcrumb for the Jarvis route', () => {
    expect(getBreadcrumbItems('/jarvis')).toEqual(['Home', 'Jarvis']);
  });

  it('falls back to the overview breadcrumb for unknown routes', () => {
    expect(getBreadcrumbItems('/unknown')).toEqual(['Home', 'Dashboard']);
  });
});
