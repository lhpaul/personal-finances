import { RoutePlaceholder } from '../../src/components/RoutePlaceholder';

export default function OnboardingReady() {
  return (
    <RoutePlaceholder
      screenId="onboarding-ready"
      route="/(onboarding)/ready"
      next={[{ href: '/categorize/intro', label: 'stage-intro' }]}
    />
  );
}
