/**
 * Live typing may pass a BankConfig.formatter a value that is not yet well-formed.
 * `formatRut` throws TypeError on that input; the field must keep the raw characters instead
 * of crashing the screen.
 */
export function applyFieldFormatter(
  formatter: ((value: string) => string) | undefined,
  value: string,
): string {
  if (!formatter) return value;
  try {
    return formatter(value);
  } catch {
    return value;
  }
}
