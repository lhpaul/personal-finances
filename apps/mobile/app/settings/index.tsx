import { RoutePlaceholder } from '../../src/components/RoutePlaceholder';

export default function Settings() {
  return (
    <RoutePlaceholder
      screenId="settings"
      route="/settings"
      next={[
        { href: '/settings/account', label: 'settings-account' },
        { href: '/settings/banks', label: 'settings-banks' },
        { href: '/settings/notifications', label: 'settings-notifications' },
        { href: '/settings/categories', label: 'settings-categories' },
        { href: '/settings/about', label: 'settings-about' },
      ]}
    />
  );
}
