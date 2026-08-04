import { TopBar } from '../../../components/ui';

export interface FlowHeaderProps {
  title: string;
  backAccessibilityLabel: string;
  onBack: () => void;
}

/**
 * The back bar shared by `bank-picker` and `bank-credentials` (implementation plan Decision 10).
 * Screen-local by design: each screen supplies its own `onBack` destination — the picker's is
 * `resolveBackHref(entryOrigin)` (Business Rule 24), the credential form's is a fixed return to
 * the picker — so this component makes no navigation decision of its own. Composes the
 * `TopBar` primitive this item added under Decision 10's contingency (neither #8 nor #12 had
 * shipped one by implementation time).
 */
export function FlowHeader({ title, backAccessibilityLabel, onBack }: FlowHeaderProps) {
  return <TopBar title={title} backAccessibilityLabel={backAccessibilityLabel} onBack={onBack} />;
}
