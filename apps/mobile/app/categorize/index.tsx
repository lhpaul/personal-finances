import { CategorizeScreen } from '../../src/features/categorization/CategorizeScreen';
import { fidelityTestId } from '../../src/lib/fidelity-preview';

export default function Categorize() {
  return <CategorizeScreen testID={fidelityTestId('categorize')} />;
}
