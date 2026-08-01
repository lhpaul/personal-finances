/**
 * Design-system primitives barrel — mirrors `design/mockups/mobile/index.html`'s `mu-*`
 * classes one-to-one (see the implementation plan's `mu-class` Classification section).
 *
 * `_internal/` modules (e.g. `_internal/Overlay`) are deliberately not exported here — they
 * back a public primitive without being part of the public surface.
 */

export { Badge, type BadgeProps, type BadgeTone } from './Badge';
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './Button';
export { Card, type CardProps, type CardVariant } from './Card';
export {
  CategoryChip,
  type CategoryChipProps,
  type CategoryChipState,
} from './CategoryChip';
export { Hero, type HeroGradient, type HeroProps } from './Hero';
export { Note, type NoteProps, type NoteTone } from './Note';
export { StatTile, type StatTileArrow, type StatTileProps, type StatTileTone } from './StatTile';
export { Text, type TextProps, type TextTone, type TextVariant } from './Text';
export {
  TransactionRow,
  type TransactionRowDirection,
  type TransactionRowMetaTone,
  type TransactionRowProps,
  type TransactionRowState,
} from './TransactionRow';
