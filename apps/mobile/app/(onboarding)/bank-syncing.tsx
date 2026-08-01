import { RoutePlaceholder } from '../../src/components/RoutePlaceholder';

export default function BankSyncing() {
  return (
    <RoutePlaceholder
      screenId="bank-syncing"
      route="/(onboarding)/bank-syncing"
      next={[{ href: '/(onboarding)/bank-connected', label: 'bank-connected' }]}
    />
  );
}
