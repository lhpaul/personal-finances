import { RoutePlaceholder } from '../../../src/components/RoutePlaceholder';

export default function NotificationsIntro() {
  return (
    <RoutePlaceholder
      screenId="notifications-intro"
      route="/(onboarding)/notifications"
      next={[
        {
          href: '/(onboarding)/notifications/schedule',
          label: 'notifications-schedule',
        },
      ]}
    />
  );
}
