import { NavigationItem } from '@/components/templates/layout/Navigation/NavigationItem.tsx';
import { Logo } from '@/components/templates/layout/Brand/Logo.tsx';
import {
  MdClose as CloseIcon,
  MdMenu as MenuIcon,
  MdOutlineHome as HomeIcon,
  MdOutlineMail as MailIcon,
  MdOutlineMonitorWeight as MonitorModeIcon,
  MdOutlineTask as TaskIcon,
  MdSettings as SettingsIcon,
} from 'react-icons/md';
import { RiArrowLeftRightLine as IncomeAndExpenseIcon, RiStockLine as InvestIcon } from 'react-icons/ri';
import { PiSidebarSimpleDuotone as NavigationToggleIcon, PiWaveform as JarvisIcon } from 'react-icons/pi';
import { NavigationGroup } from '@/components/templates/layout/Navigation/NavigationGroup.tsx';
import { useState } from 'react';
import { cx } from '@/utils/styles.ts';
import { BrandIdentity } from '@/components/templates/layout/Brand/BrandIdentity.tsx';

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
          <aside className="absolute left-0 top-0 h-dvh w-72 max-w-[calc(100vw-2rem)] border-r border-(--color-section-border) bg-(--color-bg) p-4 flex flex-col gap-4 @container">
            <div className="w-full flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 @container">
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
          'hidden md:flex h-dvh min-h-0 shrink-0 flex-col gap-4 overflow-hidden bg-(--color-bg) p-2 transition-[width] duration-300 ease-out @container',
          isDesktopOpen ? 'w-64' : 'w-16',
        )}
      >
        <div className="w-full h-14 flex items-center gap-0 p-2 @[14rem]:gap-4">
          <Logo />
          <div className="hidden @[14rem]:block">
            <BrandIdentity />
          </div>
        </div>

        <DrawerContent />

        <div className="w-full mt-auto flex justify-center @[14rem]:justify-end">
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

function DrawerContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="w-full min-h-0 flex-1 flex flex-col gap-2">
      <nav className="w-full flex flex-col gap-2 overflow-y-auto">
        <NavigationItem Icon={HomeIcon} href="/" onClick={onNavigate}>
          Overview
        </NavigationItem>
        <NavigationItem Icon={JarvisIcon} href="/jarvis" onClick={onNavigate}>
          Jarvis
        </NavigationItem>
        <NavigationGroup title="Work">
          <NavigationItem Icon={TaskIcon}>Tasks</NavigationItem>
          <NavigationItem Icon={MailIcon}>E-Mail</NavigationItem>
        </NavigationGroup>
        <NavigationGroup title="Finance">
          <NavigationItem Icon={IncomeAndExpenseIcon} href="/finance/transactions" onClick={onNavigate}>
            Transactions
          </NavigationItem>
          <NavigationItem Icon={InvestIcon}>Invest</NavigationItem>
        </NavigationGroup>
      </nav>
      <div className="w-full mt-auto pt-4 flex flex-col gap-1">
        <NavigationItem Icon={SettingsIcon}>Settings</NavigationItem>
        <NavigationItem Icon={MonitorModeIcon}>Display</NavigationItem>
      </div>
    </div>
  );
}
