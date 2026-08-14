import type { MovementDirection, ProductType, RawMovementPayload } from './scrape-result.types';

/** A credential field the connect flow renders (id, label, validation) — bank-agnostic shape. */
export interface BankField {
  id: string;
  label: string;
  type: 'text' | 'password';
  placeholder: string;
  maxLength?: number;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  validation?: {
    pattern?: RegExp;
    message?: string;
    fn?: (value: string) => boolean;
  };
  formatter?: (value: string) => string;
}

/** One entry in `BankConfig.scripts`: a URL path and the script generator it triggers. */
export interface ScriptConfig {
  path: string;
  script: (input: unknown) => string;
  singleExecution: boolean;
  delay?: number; // milliseconds
}

/**
 * Translates a bank's own wording into the shared vocabulary (spec Business Rules 16-17,
 * Decision 11). Every Spanish-facing mapping for a bank lives in its own `<bank>.normalizer.ts`,
 * never in the engine.
 */
export interface BankNormalizer {
  /**
   * `null` means the bank's kind token is outside the enumerated set (Business Rule 16): the
   * caller records `kindKey` in `skippedProductKinds` and reports no product for it, without
   * turning an otherwise-clean read into anything but `complete`.
   */
  mapProductKind(kindKey: string): ProductType | null;
  /** Read from which text field the bank populated — never assumed from the product kind. */
  mapMovementDirection(payload: RawMovementPayload): MovementDirection;
  /** Keyed by stable identifiers (Decision 11) — never the bank's Spanish column headings. */
  mapMovementExtras(payload: RawMovementPayload): Readonly<Record<string, string | number | boolean>>;
}

/** One bank's complete, self-contained configuration (Business Rule 24). */
export interface BankConfig {
  id: string;
  name: string;
  url: string;
  /** Exact-origin allowlist (Business Rule 5, Decision 4). Checked with `URL.origin`, never a suffix match. */
  allowedOrigins: readonly string[];
  /** The one origin a credential may ever be typed into. */
  credentialEntryOrigin: string;
  fields: BankField[];
  scripts: Record<string, ScriptConfig>;
  normalizer: BankNormalizer;
  /**
   * When set, the host WebView loads this markup with `baseUrl` equal to {@link BankConfig.url}
   * instead of fetching a remote page. Used only by synthetic banks (no third-party navigation).
   */
  inlineHtml?: string;
}

/** The seam between the engine and the hidden browser (Decision 14). No `react-native-webview` import. */
export interface WebViewPort {
  navigateTo(url: string): void;
  injectJavaScript(source: string): void;
  stopLoading(): void;
  getCurrentUrl(): string | null;
}
