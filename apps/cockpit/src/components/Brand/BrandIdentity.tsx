import { BRAND_LABEL, PRODUCT_NAME } from '@/config.ts';

export function BrandIdentity() {
  return (
    <div className="flex flex-col leading-none">
      <span className="text-sm uppercase tracking-[0.2em] text-(--color-txt-sec)">
        {BRAND_LABEL}
      </span>
      <span className="text-md uppercase tracking-[0.2em] text-(--color-pri) font-semibold animate-rainbow">
        {PRODUCT_NAME}
      </span>
    </div>
  );
}
