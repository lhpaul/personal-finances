import { Link } from 'expo-router';
import { Text, View } from 'react-native';

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
};

/**
 * Shared placeholder screen for every MVP route in this item.
 *
 * Deliberately unstyled: no colour, spacing or typography choice is made here (spec UX
 * Rules) — the theme and design-system primitives are mirrored into the app by a later item.
 * It renders only the mockup screen identifier, the route, and links to the manifest's next
 * destinations. No product data — real or sample — is ever shown.
 */
export function RoutePlaceholder({ screenId, route, next = [] }: RoutePlaceholderProps) {
  return (
    <View>
      <Text>PLACEHOLDER — not implemented</Text>
      <Text>Mockup screen: {screenId}</Text>
      <Text>Route: {route}</Text>
      {next.map((link) => (
        <Link key={link.href} href={link.href as never}>
          <Text>Next: {link.label}</Text>
        </Link>
      ))}
    </View>
  );
}
