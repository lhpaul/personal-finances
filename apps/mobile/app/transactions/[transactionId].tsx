import { RoutePlaceholder } from '../../src/components/RoutePlaceholder';

export default function TransactionDetail() {
  return <RoutePlaceholder screenId="transaction-detail" route="/transactions/[transactionId]" />;
}
