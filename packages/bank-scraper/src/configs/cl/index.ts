import type { BankConfig } from '../../types/bank-config.types';
import { BANCO_DE_CHILE_CONFIG } from './banco-de-chile/banco-de-chile.config';
import { BANCO_FALABELLA_CONFIG } from './banco-falabella/banco-falabella.config';
import { BANCO_PELOTILLEHUE_CONFIG } from './banco-pelotillehue/banco-pelotillehue.config';

/** Every bank this package supports for Chile. */
export const CL_BANKS: readonly BankConfig[] = [
  BANCO_DE_CHILE_CONFIG,
  BANCO_FALABELLA_CONFIG,
  BANCO_PELOTILLEHUE_CONFIG,
];
