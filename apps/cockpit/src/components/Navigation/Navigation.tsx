import { NavigationItem } from '@/components/Navigation/NavigationItem.tsx';
import { Logo } from '@/components/Brand/Logo.tsx';
import {
  MdOutlineHome as HomeIcon,
  MdOutlineMonitorWeight as MonitorModeIcon,
  MdSettings as SettingsIcon,
} from 'react-icons/md';
import { PiSidebarSimpleDuotone as NavigationToggleIcon } from 'react-icons/pi';
import { NavigationGroup } from '@/components/Navigation/NavigationGroup.tsx';

const brandLabel = 'Butlr';
const productName = 'Dashboard';

export function Navigation() {
  return (
    <div className="flex flex-col lg:gap-4">
      <div className="hidden lg:flex items-center gap-4">
        <Logo />
        <div className="flex flex-col flex-1 leading-none">
          <span className="text-sm uppercase tracking-[0.2em] text-(--theme-text)">{brandLabel}</span>
          <span className="text-md  uppercase tracking-[0.2em] text-(--theme-text) font-semibold">{productName}</span>
        </div>
        <button>
          <NavigationToggleIcon className="w-6 h-6 text-(--theme-text)" />
        </button>
      </div>
      <nav className="h-12 lg:h-full lg:w-64 flex flex-row lg:flex-col gap-2 lg:gap-4 items-center">
        <NavigationItem Icon={HomeIcon}>Overview</NavigationItem>
        <NavigationGroup title="Finance">
          <NavigationItem>item 1</NavigationItem>
          <NavigationItem>item 2 with long name name name name</NavigationItem>
        </NavigationGroup>
        <NavigationGroup title="Tools"></NavigationGroup>
      </nav>
      <div className="hidden lg:flex gap-2">
        <SettingsIcon />
        <MonitorModeIcon />
      </div>
    </div>
  );
}
