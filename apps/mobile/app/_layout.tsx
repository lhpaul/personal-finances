import '../src/i18n';

import { Stack } from 'expo-router';

import { useReminderTapRouting } from '../src/features/reminders/use-reminder-tap-routing';

export default function RootLayout() {
  // Implementation plan for issue #18, Decision 15: registers the notification-response listener
  // and routes a warm/cold-start reminder tap to `/categorize/intro`. Additive — item #8's plan
  // states this file needs no change for the launch gate, and this hook does nothing else here.
  useReminderTapRouting();
  return <Stack />;
}
