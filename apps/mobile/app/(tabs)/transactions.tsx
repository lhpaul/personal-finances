import { RoutePlaceholder } from '../../src/components/RoutePlaceholder';

export default function Transactions() {
  return (
    <RoutePlaceholder
      screenId="transactions"
      route="/(tabs)/transactions"
      next={[{ href: '/transactions/any-transaction', label: 'transaction-detail' }]}
    />
  );
}
