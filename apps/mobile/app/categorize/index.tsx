import { RoutePlaceholder } from '../../src/components/RoutePlaceholder';

export default function Categorize() {
  return (
    <RoutePlaceholder
      screenId="categorize"
      route="/categorize"
      next={[{ href: '/categorize/merchant/any-merchant', label: 'merchant-edit' }]}
    />
  );
}
