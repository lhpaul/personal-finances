import { RoutePlaceholder } from '../../../src/components/RoutePlaceholder';

export default function NotificationsSchedule() {
  return (
    <RoutePlaceholder
      screenId="notifications-schedule"
      route="/(onboarding)/notifications/schedule"
      next={[{ href: '/(onboarding)/ready', label: 'onboarding-ready' }]}
    />
  );
}
