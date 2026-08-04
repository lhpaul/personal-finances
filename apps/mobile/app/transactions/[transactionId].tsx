import { useLocalSearchParams } from 'expo-router';

import { TransactionDetailScreen } from '../../src/features/transaction-detail/TransactionDetailScreen';
import { fidelityTestId } from '../../src/lib/fidelity-preview';

export default function TransactionDetail() {
  const { transactionId } = useLocalSearchParams<{ transactionId: string }>();
  return <TransactionDetailScreen transactionId={transactionId} testID={fidelityTestId('transaction-detail')} />;
}
