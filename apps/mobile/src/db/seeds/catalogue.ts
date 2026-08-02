import tokens from '../../../../../design/tokens.json';
import {
  categorySeedId,
  institutionSeedId,
  merchantAliasSeedId,
  merchantSeedId,
} from '../ids';
import type { Assets, CategoryLabels, InstitutionMetadata } from '../json';

/**
 * Starter content (implementation plan's Seed Data Contract, Layer-by-Layer "Seed data" section).
 * The sixteen categories are **generated** from `design/tokens.json`, not retyped — a token edit
 * therefore changes the seed automatically, and `src/db/seeds/__tests__/catalogue.test.ts`
 * asserts the generated slug set equals the token file's slug set in both directions (Risks
 * table: "Seed catalogue and design/tokens.json drift").
 */

export type SeedEntityType =
  | 'financial_institution'
  | 'transaction_category'
  | 'merchant'
  | 'merchant_alias';

export interface FinancialInstitutionSeed {
  seedKey: string;
  entityType: 'financial_institution';
  id: string;
  countryCode: string;
  name: string;
  assets: Assets;
  metadata: InstitutionMetadata;
  scraperStatus: 'available' | 'coming_soon';
}

export interface TransactionCategorySeed {
  seedKey: string;
  entityType: 'transaction_category';
  id: string;
  slug: string;
  income: 0 | 1;
  labels: CategoryLabels;
  assets: Assets;
  sortOrder: number;
}

export interface MerchantSeed {
  seedKey: string;
  entityType: 'merchant';
  id: string;
  slug: string;
  name: string;
  countryCode: string | null;
  defaultCategorySlug: string;
}

export interface MerchantAliasSeed {
  seedKey: string;
  entityType: 'merchant_alias';
  id: string;
  merchantSlug: string;
  rawPattern: string;
  matchType: string;
}

export interface Catalogue {
  financialInstitutions: FinancialInstitutionSeed[];
  transactionCategories: TransactionCategorySeed[];
  merchants: MerchantSeed[];
  merchantAliases: MerchantAliasSeed[];
}

// -------------------------------------------------------------------------------------------
// Banks — spec Seed Data Contract → Banks. Only `banco-de-chile` must match the scraper's
// `bankId` (it is `available`); the other five are provisional identifiers, display-only until
// their scrapers exist (spec Decision 9).
// -------------------------------------------------------------------------------------------
const BANKS: readonly {
  slug: string;
  name: string;
  scraperStatus: 'available' | 'coming_soon';
  shortName: string;
  brandColor: string;
}[] = [
  {
    slug: 'banco-de-chile',
    name: 'Banco de Chile',
    scraperStatus: 'available',
    shortName: 'BCH',
    brandColor: '#003da5', // style-literal-allow: seeded bank data, not a UI style value
  },
  {
    slug: 'santander',
    name: 'Banco Santander',
    scraperStatus: 'coming_soon',
    shortName: 'SAN',
    brandColor: '#ec0000', // style-literal-allow: seeded bank data, not a UI style value
  },
  {
    slug: 'bci',
    name: 'Banco BCI',
    scraperStatus: 'coming_soon',
    shortName: 'BCI',
    brandColor: '#00396a', // style-literal-allow: seeded bank data, not a UI style value
  },
  {
    slug: 'banco-estado',
    name: 'BancoEstado',
    scraperStatus: 'coming_soon',
    shortName: 'EST',
    brandColor: '#e30613', // style-literal-allow: seeded bank data, not a UI style value
  },
  {
    slug: 'falabella',
    name: 'Banco Falabella',
    scraperStatus: 'coming_soon',
    shortName: 'FAL',
    brandColor: '#78b833', // style-literal-allow: seeded bank data, not a UI style value
  },
  {
    slug: 'itau',
    name: 'Banco Itaú',
    scraperStatus: 'coming_soon',
    shortName: 'ITA',
    brandColor: '#1b3a6b', // style-literal-allow: seeded bank data, not a UI style value
  },
];

export function buildFinancialInstitutionSeeds(): FinancialInstitutionSeed[] {
  return BANKS.map((bank) => ({
    seedKey: `financial_institution:${bank.slug}`,
    entityType: 'financial_institution',
    id: institutionSeedId(bank.slug),
    countryCode: 'CL',
    name: bank.name,
    assets: { logo: `asset://banks/${bank.slug}.png` },
    metadata: { short_name: bank.shortName, brand_color: bank.brandColor },
    scraperStatus: bank.scraperStatus,
  }));
}

// -------------------------------------------------------------------------------------------
// Categories — generated from design/tokens.json → categoryIcons / categoryLabels, keyed by the
// same slug. The tokens file's `otros` key is emitted as `otros-gasto` in the expense direction
// and `otros-ingreso` in the income direction (spec Seed Data Contract → Categories); the
// `uncategorized` glyph is never emitted as a category (AC3).
// -------------------------------------------------------------------------------------------
type Direction = 'expense' | 'income';

interface TokenCategoryLabel {
  es: string;
  en: string;
}

const categoryIcons = tokens.categoryIcons as unknown as {
  expense: Record<string, string>;
  income: Record<string, string>;
};
const categoryLabels = tokens.categoryLabels as unknown as {
  expense: Record<string, TokenCategoryLabel>;
  income: Record<string, TokenCategoryLabel>;
};

function seedSlugFor(direction: Direction, tokenSlug: string): string {
  if (tokenSlug === 'otros') return direction === 'expense' ? 'otros-gasto' : 'otros-ingreso';
  return tokenSlug;
}

function buildCategoriesForDirection(direction: Direction): TransactionCategorySeed[] {
  const icons = categoryIcons[direction];
  const labels = categoryLabels[direction];
  return Object.keys(icons).map((tokenSlug, index) => {
    const slug = seedSlugFor(direction, tokenSlug);
    const label = labels[tokenSlug];
    return {
      seedKey: `transaction_category:${slug}`,
      entityType: 'transaction_category',
      id: categorySeedId(slug),
      slug,
      income: direction === 'income' ? 1 : 0,
      labels: { es: label?.es, en: label?.en },
      assets: { emoji: icons[tokenSlug] ?? '' },
      sortOrder: index + 1,
    };
  });
}

export function buildTransactionCategorySeeds(): TransactionCategorySeed[] {
  return [...buildCategoriesForDirection('expense'), ...buildCategoriesForDirection('income')];
}

// -------------------------------------------------------------------------------------------
// Merchants — spec Seed Data Contract → Merchants, a minimum set plus required properties (spec
// Decision 10). Alias patterns drawn from how each merchant actually appears on a Chilean bank
// statement.
// -------------------------------------------------------------------------------------------
const MERCHANTS: readonly {
  slug: string;
  name: string;
  countryCode: string | null;
  defaultCategorySlug: string;
  aliases: string[];
}[] = [
  {
    slug: 'lider',
    name: 'Líder',
    countryCode: 'CL',
    defaultCategorySlug: 'supermercado',
    aliases: ['LIDER'],
  },
  {
    slug: 'jumbo',
    name: 'Jumbo',
    countryCode: 'CL',
    defaultCategorySlug: 'supermercado',
    aliases: ['JUMBO'],
  },
  {
    slug: 'uber',
    name: 'Uber',
    countryCode: null,
    defaultCategorySlug: 'transporte',
    aliases: ['UBER *TRIP'],
  },
  {
    slug: 'copec',
    name: 'Copec',
    countryCode: 'CL',
    defaultCategorySlug: 'transporte',
    aliases: ['COPEC'],
  },
  {
    slug: 'netflix',
    name: 'Netflix',
    countryCode: null,
    defaultCategorySlug: 'entretenimiento',
    aliases: ['NETFLIX.COM'],
  },
];

export function buildMerchantSeeds(): MerchantSeed[] {
  return MERCHANTS.map((merchant) => ({
    seedKey: `merchant:${merchant.slug}`,
    entityType: 'merchant',
    id: merchantSeedId(merchant.slug),
    slug: merchant.slug,
    name: merchant.name,
    countryCode: merchant.countryCode,
    defaultCategorySlug: merchant.defaultCategorySlug,
  }));
}

export function buildMerchantAliasSeeds(): MerchantAliasSeed[] {
  return MERCHANTS.flatMap((merchant) =>
    merchant.aliases.map((rawPattern) => ({
      seedKey: `merchant_alias:${merchant.slug}:${rawPattern.trim().toUpperCase()}`,
      entityType: 'merchant_alias' as const,
      id: merchantAliasSeedId(merchant.slug, rawPattern),
      merchantSlug: merchant.slug,
      rawPattern,
      matchType: 'prefix',
    })),
  );
}

export function buildCatalogue(): Catalogue {
  return {
    financialInstitutions: buildFinancialInstitutionSeeds(),
    transactionCategories: buildTransactionCategorySeeds(),
    merchants: buildMerchantSeeds(),
    merchantAliases: buildMerchantAliasSeeds(),
  };
}
