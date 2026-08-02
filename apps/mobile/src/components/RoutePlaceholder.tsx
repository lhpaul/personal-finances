import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export type RoutePlaceholderNextLink = {
  href: string;
  label: string;
};

export type RoutePlaceholderProps = {
  /** The mockup manifest `screen_id` this route stands for (spec UX Rules, AC5). */
  screenId: string;
  /** The manifest route path this placeholder implements (spec Business Rule 3). */
  route: string;
  /** Manifest successors, so the skeleton can be walked end to end (spec UX Rules). */
  next?: RoutePlaceholderNextLink[];
  /**
   * The design-fidelity gate's readiness selector for a `wired` target
   * (`fidelityTestId(screenId)`, implementation plan Decision 9). Undefined for every screen
   * that has not been wired yet — the fidelity contract validates this string appears in the
   * route's source once a mapping flips to `status: "wired"`.
   */
  testID?: string;
};

/**
 * Shared placeholder screen for every MVP route in this item.
 *
 * Deliberately unstyled: no colour, spacing or typography choice is made here (spec UX
 * Rules) — the theme and design-system primitives are mirrored into the app by a later item.
 * It renders only the mockup screen identifier, the route, and links to the manifest's next
 * destinations. No product data — real or sample — is ever shown.
 *
 * Copy comes from the `dev.placeholder.*` catalogue keys (implementation plan Decision 9) —
 * this is disposable scaffolding from item #1, not screen copy sourced from a mockup, and is
 * deleted along with this component when the last screen item lands.
 */
export function RoutePlaceholder({ screenId, route, next = [], testID }: RoutePlaceholderProps) {
  const { t } = useTranslation();
  return (
    <View testID={testID}>
      <Text>{t('dev.placeholder.title')}</Text>
      <Text>{t('dev.placeholder.screen', { screenId })}</Text>
      <Text>{t('dev.placeholder.route', { route })}</Text>
      {next.map((link) => (
        <Link key={link.href} href={link.href as never}>
          <Text>{t('dev.placeholder.next', { label: link.label })}</Text>
        </Link>
      ))}
    </View>
  );
}
