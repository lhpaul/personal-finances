import type { TextStyle } from 'react-native';

/**
 * Converts a numeric `theme.typography.weight.*` value (e.g. `700`) into the string literal
 * React Native's `TextStyle['fontWeight']` expects (e.g. `'700'`), in one typed place instead
 * of an unchecked `String(...) as TextStyle['fontWeight']` cast repeated at every call site.
 */
export function fontWeight(weight: number): TextStyle['fontWeight'] {
  return String(weight) as TextStyle['fontWeight'];
}
