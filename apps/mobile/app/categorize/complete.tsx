import { RoutePlaceholder } from '../../src/components/RoutePlaceholder';

export default function CategorizeComplete() {
  return (
    <RoutePlaceholder
      screenId="categorize-complete"
      route="/categorize/complete"
      next={[{ href: '/(tabs)/home', label: 'home' }]}
    />
  );
}
