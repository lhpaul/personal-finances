import { RoutePlaceholder } from '../../src/components/RoutePlaceholder';

export default function ConnectBankIntro() {
  return (
    <RoutePlaceholder
      screenId="connect-bank-intro"
      route="/(onboarding)/connect-bank"
      next={[{ href: '/(onboarding)/bank-picker', label: 'bank-picker' }]}
    />
  );
}
