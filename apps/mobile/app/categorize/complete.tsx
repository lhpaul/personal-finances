import { CategorizeCompleteScreen } from '../../src/features/categorization/CategorizeCompleteScreen';
import { fidelityTestId } from '../../src/lib/fidelity-preview';

export default function CategorizeComplete() {
  return <CategorizeCompleteScreen testID={fidelityTestId('categorize-complete')} />;
}
