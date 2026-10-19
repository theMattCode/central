import { Icon } from '@/components/Icon/Icon.tsx';
import { PocketKnifeIcon } from '@/components/Icon/OriginalIcons.tsx';

export function Logo() {
  return <Icon icon={PocketKnifeIcon} label="Central logo" class="h-8 w-8 text-(--color-pri) animate-rainbow" />;
}
