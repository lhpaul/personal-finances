import { StageIntroScreen } from '../../src/features/categorization/StageIntroScreen';
import { fidelityTestId } from '../../src/lib/fidelity-preview';

export default function StageIntro() {
  return <StageIntroScreen testID={fidelityTestId('stage-intro')} />;
}
