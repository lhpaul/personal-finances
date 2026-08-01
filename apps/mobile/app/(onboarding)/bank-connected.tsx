import { RoutePlaceholder } from '../../src/components/RoutePlaceholder';

export default function BankConnected() {
  return (
    <RoutePlaceholder
      screenId="bank-connected"
      route="/(onboarding)/bank-connected"
      next={[{ href: '/(onboarding)/notifications', label: 'notifications-intro' }]}
    />
  );
}
