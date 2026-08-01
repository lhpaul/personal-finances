import { RoutePlaceholder } from '../../src/components/RoutePlaceholder';

export default function Home() {
  return (
    <RoutePlaceholder
      screenId="home"
      route="/(tabs)/home"
      next={[
        { href: '/(tabs)/transactions', label: 'transactions' },
        { href: '/dashboard', label: 'dashboard' },
        { href: '/settings', label: 'settings' },
      ]}
    />
  );
}
