import { RoutePlaceholder } from '../../../src/components/RoutePlaceholder';

export default function SettingsBanks() {
  return (
    <RoutePlaceholder
      screenId="settings-banks"
      route="/settings/banks"
      next={[{ href: '/settings/banks/any-bank', label: 'bank-review' }]}
    />
  );
}
