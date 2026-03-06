import { NavigationItem } from '@/components/Navigation/NavigationItem.tsx';
import { Logo } from '@/components/Brand/Logo.tsx';
import {
  MdClose as CloseIcon,
  MdMenu as MenuIcon,
  MdOutlineHome as HomeIcon,
  MdOutlineMonitorWeight as MonitorModeIcon,
  MdSettings as SettingsIcon,
} from 'react-icons/md';
import { PiSidebarSimpleDuotone as NavigationToggleIcon } from 'react-icons/pi';
import { NavigationGroup } from '@/components/Navigation/NavigationGroup.tsx';
import { useState } from 'react';
import { cx } from '@/utils/styles.ts';

const brandLabel = 'Central';
const productName = 'Dashboard';

export function Navigation() {
  const [isDesktopOpen, setIsDesktopOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const closeMobileDrawer = () => setIsMobileOpen(false);

  return (
    <>
      <div className="md:hidden w-full shrink-0 flex items-center justify-between border-b border-(--color-section-border) px-3 py-2">
        <Logo />
        <button
          type="button"
          aria-label="Open mobile navigation"
          className="rounded-lg p-2 text-(--color-txt-sec) hover:bg-(--color-pri)/10 hover:text-(--color-pri)"
          onClick={() => setIsMobileOpen(true)}
        >
          <MenuIcon className="w-6 h-6" />
        </button>
      </div>

      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close mobile navigation backdrop"
            className="absolute inset-0 bg-black/40"
            onClick={closeMobileDrawer}
          />
          <aside className="absolute left-0 top-0 h-dvh w-72 max-w-[calc(100vw-2rem)] border-r border-(--color-section-border) bg-(--color-bg) p-4 flex flex-col gap-4">
            <div className="w-full flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <Logo />
                <BrandIdentity />
              </div>
              <button
                type="button"
                aria-label="Close mobile navigation"
                className="rounded-lg p-2 text-(--color-txt-sec) hover:bg-(--color-pri)/10 hover:text-(--color-pri)"
                onClick={closeMobileDrawer}
              >
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>
            <DrawerContent onNavigate={closeMobileDrawer} />
          </aside>
        </div>
      )}

      <aside
        className={cx(
          'hidden md:flex h-dvh min-h-0 shrink-0 flex-col gap-4 bg-(--color-bg) p-2 transition-[width] duration-300 ease-out',
          isDesktopOpen ? 'w-72' : 'w-20',
        )}
      >
        <div className={cx('w-full flex items-center p-2', isDesktopOpen ? 'gap-3' : 'justify-center')}>
          <Logo />
          {isDesktopOpen && <BrandIdentity />}
        </div>

        {isDesktopOpen && <DrawerContent />}

        <div className={cx('w-full mt-auto flex', isDesktopOpen ? 'justify-end' : 'justify-center')}>
          <button
            type="button"
            aria-label={isDesktopOpen ? 'Collapse navigation' : 'Expand navigation'}
            className="rounded-lg p-2 text-(--color-txt-sec) hover:bg-(--color-pri)/10 hover:text-(--color-pri)"
            onClick={() => setIsDesktopOpen((value) => !value)}
          >
            <NavigationToggleIcon className={cx('w-6 h-6 hover:text-(--color-pri)')} />
          </button>
        </div>
      </aside>
    </>
  );
}

function BrandIdentity() {
  return (
    <div className="flex flex-col leading-none">
      <span className="text-sm uppercase tracking-[0.2em] text-(--color-txt-sec)">{brandLabel}</span>
      <span className="text-md uppercase tracking-[0.2em] text-(--color-txt) font-semibold">{productName}</span>
    </div>
  );
}

function DrawerContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="w-full min-h-0 flex-1 flex flex-col gap-4">
      <nav className="w-full flex flex-col gap-4 overflow-y-auto">
        <NavigationItem Icon={HomeIcon} onClick={onNavigate}>
          Overview
        </NavigationItem>
        <NavigationGroup title="Finance">
          <NavigationItem onClick={onNavigate}>item 1</NavigationItem>
          <NavigationItem onClick={onNavigate}>item 2 with long name name name name</NavigationItem>
        </NavigationGroup>
        <NavigationGroup title="Tools" />
      </nav>
      <div className="w-full mt-auto pt-4 flex flex-col gap-1">
        <NavigationItem Icon={SettingsIcon} onClick={onNavigate}>
          Settings
        </NavigationItem>
        <NavigationItem Icon={MonitorModeIcon} onClick={onNavigate}>
          Display
        </NavigationItem>
      </div>
    </div>
  );
}
