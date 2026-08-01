import { RoutePlaceholder } from '../../../src/components/RoutePlaceholder';

export default function MerchantEdit() {
  return (
    <RoutePlaceholder
      screenId="merchant-edit"
      route="/categorize/merchant/[merchantId]"
      next={[{ href: '/categorize/complete', label: 'categorize-complete' }]}
    />
  );
}
