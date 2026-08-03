import type { BankConfig } from '../types/bank-config.types';
import { CL_BANKS } from './cl';

/** The bank registry, keyed by country code. Consulted only by the barrel and by tests. */
export const BANK_CONFIGS: Readonly<Record<string, readonly BankConfig[]>> = {
  cl: CL_BANKS,
};
