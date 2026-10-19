import { BRAND_LABEL, PRODUCT_NAME } from '@/config.ts';

export function BrandIdentity() {
  return (
    <div class="flex flex-col leading-none">
      <span class="text-sm uppercase tracking-[0.2em] text-(--color-txt-sec)">{BRAND_LABEL}</span>
      <span class="text-md uppercase tracking-[0.2em] text-(--color-pri) font-semibold animate-rainbow">
        {PRODUCT_NAME}
      </span>
    </div>
  );
}
