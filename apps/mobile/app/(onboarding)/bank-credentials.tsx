import { RoutePlaceholder } from '../../src/components/RoutePlaceholder';

export default function BankCredentials() {
  return (
    <RoutePlaceholder
      screenId="bank-credentials"
      route="/(onboarding)/bank-credentials"
      next={[{ href: '/(onboarding)/bank-syncing', label: 'bank-syncing' }]}
    />
  );
}
