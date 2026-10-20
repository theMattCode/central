import { NavigationItem } from '@/components/Navigation/NavigationItem.tsx';
import { Logo } from '@/components/Brand/Logo.tsx';
import {
  MdFillClose as CloseIcon,
  MdFillMenu as MenuIcon,
  MdOutlineHome as HomeIcon,
  MdOutlineMail as MailIcon,
  MdOutlineMonitor_weight as MonitorModeIcon,
  MdOutlineTask as TaskIcon,
  MdFillSettings as SettingsIcon,
} from 'solid-icons/md';
import {
  RiArrowsArrowLeftRightLine as IncomeAndExpenseIcon,
  RiBuildingsBankLine as AccountsIcon,
  RiFinanceStockLine as InvestIcon,
} from 'solid-icons/ri';
import { NavigationGroup } from '@/components/Navigation/NavigationGroup.tsx';
import { createSignal, Show } from 'solid-js';
import { BrandIdentity } from '@/components/Brand/BrandIdentity.tsx';
import { Icon } from '@/components/Icon/Icon.tsx';
import {
  SidebarSimpleDuotoneIcon as NavigationToggleIcon,
  WaveformIcon as JarvisIcon,
} from '@/components/Icon/OriginalIcons.tsx';

export function Navigation() {
  const [isDesktopOpen, setIsDesktopOpen] = createSignal(true);
  const [isMobileOpen, setIsMobileOpen] = createSignal(false);

  const closeMobileDrawer = () => setIsMobileOpen(false);

  return (
    <>
      <div class="md:hidden w-full shrink-0 flex items-center justify-between border-b border-(--color-section-border) px-3 py-2">
        <Logo />
        <button
          type="button"
          aria-label="Open mobile navigation"
          class="rounded-lg p-2 text-(--color-txt-sec) hover:bg-(--color-pri)/10 hover:text-(--color-pri)"
          onClick={() => setIsMobileOpen(true)}
        >
          <Icon icon={MenuIcon} class="w-6 h-6" />
        </button>
      </div>

      <Show when={isMobileOpen()}>
        <div class="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close mobile navigation backdrop"
            class="absolute inset-0 bg-black/40"
            onClick={closeMobileDrawer}
          />
          <aside class="absolute left-0 top-0 h-dvh w-72 max-w-[calc(100vw-2rem)] bg-(--color-bg) p-4 flex flex-col gap-4 @container">
            <div class="w-full flex items-center justify-between gap-2">
              <div class="flex items-center gap-3 @container">
                <Logo />
                <BrandIdentity />
              </div>
              <button
                type="button"
                aria-label="Close mobile navigation"
                class="rounded-lg p-2 text-(--color-txt-sec) hover:bg-(--color-pri)/10 hover:text-(--color-pri)"
                onClick={closeMobileDrawer}
              >
                <Icon icon={CloseIcon} class="w-6 h-6" />
              </button>
            </div>
            <DrawerContent onNavigate={closeMobileDrawer} />
          </aside>
        </div>
      </Show>

      <aside
        class={[
          'hidden md:flex h-dvh min-h-0 shrink-0 flex-col gap-4 overflow-hidden bg-(--color-bg) p-2 transition-[width] duration-300 ease-out @container',
          { 'w-64': isDesktopOpen(), 'w-16': !isDesktopOpen() },
        ]}
      >
        <div class="w-full h-14 flex items-center gap-0 p-2 @[14rem]:gap-4">
          <Logo />
          <div class="hidden @[14rem]:block">
            <BrandIdentity />
          </div>
        </div>

        <DrawerContent />

        <div class="w-full mt-auto flex justify-center @[14rem]:justify-end">
          <button
            type="button"
            aria-label={isDesktopOpen() ? 'Collapse navigation' : 'Expand navigation'}
            class="rounded-lg p-2 text-(--color-txt-sec) hover:bg-(--color-pri)/10 hover:text-(--color-pri)"
            onClick={() => setIsDesktopOpen((value) => !value)}
          >
            <Icon icon={NavigationToggleIcon} class="w-6 h-6 hover:text-(--color-pri)" />
          </button>
        </div>
      </aside>
    </>
  );
}

function DrawerContent(props: { onNavigate?: () => void }) {
  return (
    <div class="w-full min-h-0 flex-1 flex flex-col gap-2">
      <nav class="w-full flex flex-col gap-2 overflow-y-auto">
        <NavigationItem Icon={HomeIcon} to="/" onClick={props.onNavigate}>
          Overview
        </NavigationItem>
        <NavigationItem Icon={JarvisIcon} to="/jarvis" onClick={props.onNavigate}>
          Jarvis
        </NavigationItem>
        <NavigationGroup title="Work">
          <NavigationItem Icon={TaskIcon}>Tasks</NavigationItem>
          <NavigationItem Icon={MailIcon}>E-Mail</NavigationItem>
        </NavigationGroup>
        <NavigationGroup title="Finance">
          <NavigationItem Icon={IncomeAndExpenseIcon} to="/finance/transactions" onClick={props.onNavigate}>
            Transactions
          </NavigationItem>
          <NavigationItem Icon={AccountsIcon} to="/finance/accounts" onClick={props.onNavigate}>
            Accounts
          </NavigationItem>
          <NavigationItem Icon={InvestIcon}>Invest</NavigationItem>
        </NavigationGroup>
      </nav>
      <div class="w-full mt-auto pt-4 flex flex-col gap-1">
        <NavigationItem Icon={SettingsIcon}>Settings</NavigationItem>
        <NavigationItem Icon={MonitorModeIcon}>Display</NavigationItem>
      </div>
    </div>
  );
}
