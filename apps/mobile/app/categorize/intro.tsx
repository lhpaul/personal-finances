import { RoutePlaceholder } from '../../src/components/RoutePlaceholder';

export default function StageIntro() {
  return (
    <RoutePlaceholder
      screenId="stage-intro"
      route="/categorize/intro"
      next={[{ href: '/categorize', label: 'categorize' }]}
    />
  );
}
