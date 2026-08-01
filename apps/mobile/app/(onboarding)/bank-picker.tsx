import { RoutePlaceholder } from '../../src/components/RoutePlaceholder';

export default function BankPicker() {
  return (
    <RoutePlaceholder
      screenId="bank-picker"
      route="/(onboarding)/bank-picker"
      next={[{ href: '/(onboarding)/bank-credentials', label: 'bank-credentials' }]}
    />
  );
}
