import { RoutePlaceholder } from '../../src/components/RoutePlaceholder';

export default function OnboardingValue() {
  return (
    <RoutePlaceholder
      screenId="onboarding-value"
      route="/(onboarding)/value"
      next={[{ href: '/(onboarding)/connect-bank', label: 'connect-bank-intro' }]}
    />
  );
}
