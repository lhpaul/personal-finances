import { RoutePlaceholder } from '../../src/components/RoutePlaceholder';

export default function OnboardingIntro() {
  return (
    <RoutePlaceholder
      screenId="onboarding-intro"
      route="/(onboarding)/intro"
      next={[{ href: '/(onboarding)/value', label: 'onboarding-value' }]}
    />
  );
}
