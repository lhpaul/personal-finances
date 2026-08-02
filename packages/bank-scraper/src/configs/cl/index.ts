import type { BankConfig } from '../../types/bank-config.types';
import { BANCO_DE_CHILE_CONFIG } from './banco-de-chile/banco-de-chile.config';

/** Every bank this package supports for Chile. Exactly one entry in the MVP (AC28). */
export const CL_BANKS: readonly BankConfig[] = [BANCO_DE_CHILE_CONFIG];
