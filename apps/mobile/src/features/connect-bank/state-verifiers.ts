import type { ConnectedBankSummary, PickerInstitution } from '../../db/types';
import { collectElements, elementTypeName } from '../../test-utils/element-tree';
import { BankPickerResults, type BankPickerCopy } from './components/BankPickerResults';
import { ConnectedBankSummaryList, type ConnectedBankSummaryCopy } from './components/ConnectedBankSummaryList';
import { CredentialForm, type CredentialFormCopy } from './components/CredentialForm';
import { SecurityAccordion, type SecurityAccordionCopy } from './components/SecurityAccordion';

/**
 * Real, executable per-state assertions for AC28's state-coverage residual (implementation plan
 * Testing Strategy), shared by exact function reference between each feature test file's own
 * `it(...)` calls and `state-coverage.ts`'s `CONNECT_FLOW_STATE_COVERAGE` registry.
 *
 * Deliberately **not** named `*.test.ts` and **not** under `__tests__/`: these functions call
 * Jest's `expect` global, which is only bound while a real test is executing, but they contain
 * no top-level `describe`/`it` of their own. If this lived in a `*.test.tsx` file instead,
 * `state-coverage.ts` importing it would re-execute that file's own top-level `describe` blocks
 * a second time (Jest binds `describe`/`it` per requiring test file, and a static `import`
 * re-runs the required module's top-level code) — found and avoided during this item's own
 * review-fix cycle, before it ever shipped as a bug.
 *
 * Each `verify*` function is the single, canonical implementation of one state's assertion —
 * found in review (CodeRabbit PR #80): a residual check that only scans a test file's source text
 * for a literal `describe`/`it` title proves a title survived, not that the assertions inside its
 * body still run or still assert anything real. Sharing one function object between the feature
 * test and the residual test closes that gap: weakening or deleting the assertion body fails both
 * identically, since there is exactly one implementation, not two that can drift apart.
 */

const CONNECT_BANK_INTRO_COPY: SecurityAccordionCopy = {
  toggleLabel: '¿Cómo funciona la conexión segura?',
  step1: 'Abrimos el sitio de tu banco dentro de la app, en tu teléfono.',
  step2: 'Tus credenciales se escriben en ese formulario y se guardan cifradas en el llavero del dispositivo.',
  step3: 'Leemos tus productos y movimientos y los guardamos localmente.',
};

export function verifyDefaultStateRendersCollapsed(): void {
  const tree = SecurityAccordion({ expanded: false, onToggle: jest.fn(), copy: CONNECT_BANK_INTRO_COPY });
  const texts = collectElements(tree, (el) => elementTypeName(el) === 'Text').map(
    (el) => el.props.children,
  );
  expect(texts).toContain(CONNECT_BANK_INTRO_COPY.toggleLabel);
  expect(texts).not.toContain(CONNECT_BANK_INTRO_COPY.step1);
  expect(collectElements(tree, (el) => elementTypeName(el) === 'Badge')).toHaveLength(0);
}

export function verifyHowItWorksStateRendersSteps(): void {
  const tree = SecurityAccordion({ expanded: true, onToggle: jest.fn(), copy: CONNECT_BANK_INTRO_COPY });
  const texts = collectElements(tree, (el) => elementTypeName(el) === 'Text').map(
    (el) => el.props.children,
  );
  expect(texts).toContain(CONNECT_BANK_INTRO_COPY.toggleLabel);
  expect(texts).toContain(CONNECT_BANK_INTRO_COPY.step1);
  expect(texts).toContain(CONNECT_BANK_INTRO_COPY.step2);
  expect(texts).toContain(CONNECT_BANK_INTRO_COPY.step3);

  const badges = collectElements(tree, (el) => elementTypeName(el) === 'Badge');
  expect(badges.map((badge) => badge.props.label)).toEqual(['1', '2', '3']);
}

const BANK_PICKER_COPY: BankPickerCopy = {
  listHeading: 'Bancos disponibles en Chile',
  resultCount: (count) => (count === 1 ? `${count} resultado` : `${count} resultados`),
  availableSubLabel: 'Cuentas, tarjetas y líneas',
  comingSoonLabel: 'Próximamente',
  availableBadge: 'Disponible',
  noResultsHeading: 'No encontramos ese banco',
  noResultsBody: 'Revisa el nombre o cuéntanos cuál necesitas para priorizarlo.',
  standingNote: 'El MVP soporta Banco de Chile.',
};

const BANK_PICKER_CATALOGUE: PickerInstitution[] = [
  // style-literal-allow: brandColor is a PickerInstitution fixture value (test data), not a style prop
  { id: 'banco-de-chile', name: 'Banco de Chile', scraperStatus: 'available', shortName: 'BCH', brandColor: '#003da5' },
  // style-literal-allow: brandColor is a PickerInstitution fixture value (test data), not a style prop
  { id: 'santander', name: 'Banco Santander', scraperStatus: 'coming_soon', shortName: 'SAN', brandColor: '#ec0000' },
];

function renderBankPickerResults(query: string) {
  return BankPickerResults({
    institutions: BANK_PICKER_CATALOGUE,
    query,
    onSelectInstitution: jest.fn(),
    copy: BANK_PICKER_COPY,
  });
}

export function verifyListStateShowsBothRows(): void {
  const tree = renderBankPickerResults('');
  const rows = collectElements(tree, (el) => elementTypeName(el) === 'BankRow');
  expect(rows).toHaveLength(2);

  const availableRow = rows.find((row) => row.props.name === 'Banco de Chile');
  expect(availableRow).toBeDefined();
  expect(availableRow?.props.onPress).toBeInstanceOf(Function);
  expect(availableRow?.props.unavailableLabel).toBeUndefined();
  expect(availableRow?.props.trailingAccessory?.props.label).toBe('Disponible');

  const comingSoonRow = rows.find((row) => row.props.name === 'Banco Santander');
  expect(comingSoonRow).toBeDefined();
  expect(comingSoonRow?.props.onPress).toBeUndefined();
  expect(comingSoonRow?.props.unavailableLabel).toBe('Próximamente');
  expect(comingSoonRow?.props.trailingAccessory).toBeUndefined();

  const heading = collectElements(tree, (el) => elementTypeName(el) === 'Text')[0];
  expect(heading?.props.children).toBe('Bancos disponibles en Chile');
}

export function verifySearchStateNarrowsResults(): void {
  const tree = renderBankPickerResults('chi');
  const rows = collectElements(tree, (el) => elementTypeName(el) === 'BankRow');
  expect(rows).toHaveLength(1);
  expect(rows[0]?.props.name).toBe('Banco de Chile');
}

export function verifyNoResultsStateShowsEmptyState(): void {
  const tree = renderBankPickerResults('banco imaginario');

  expect(elementTypeName(tree)).toBe('EmptyState');
  expect(tree.props).toMatchObject({
    title: 'No encontramos ese banco',
    description: 'Revisa el nombre o cuéntanos cuál necesitas para priorizarlo.',
  });
  expect(collectElements(tree, (el) => elementTypeName(el) === 'BankRow')).toHaveLength(0);
  expect(collectElements(tree, (el) => elementTypeName(el) === 'Note')).toHaveLength(0);
}

const CREDENTIAL_FORM_COPY: CredentialFormCopy = {
  subtitle: 'Ingresa tus credenciales de banca en línea',
  privacyNote: 'Estos datos se cifran y se guardan solo en este teléfono.',
  rutLabel: 'RUT',
  rutPlaceholder: '12.345.678-9',
  passwordLabel: 'Clave de internet',
  passwordPlaceholder: '••••••••',
  rutLockedHint: 'Todos tus bancos deben estar a nombre del mismo RUT.',
  connectCta: 'Conectar',
  cancelCta: 'Cancelar',
};

function credentialFormBaseProps() {
  return {
    bankMonogram: 'BCH',
    // style-literal-allow: bankMonogramColor is a CredentialForm fixture value (test data), not a style prop
    bankMonogramColor: '#003da5',
    bankName: 'Banco de Chile',
    rut: '',
    onChangeRut: jest.fn(),
    password: '',
    onChangePassword: jest.fn(),
    locked: false,
    errorMessage: undefined as string | undefined,
    canConnect: false,
    onConnect: jest.fn(),
    onCancel: jest.fn(),
    copy: CREDENTIAL_FORM_COPY,
  };
}

function credentialFormTextFields(tree: ReturnType<typeof CredentialForm>) {
  return collectElements(tree, (el) => elementTypeName(el) === 'TextField');
}

export function verifyEmptyStateMasksPasswordAndDisablesConnect(): void {
  const tree = CredentialForm(credentialFormBaseProps());
  const fields = credentialFormTextFields(tree);
  const passwordField = fields.find((field) => field.props.label === 'Clave de internet');
  expect(passwordField?.props.secureTextEntry).toBe(true);

  const buttons = collectElements(tree, (el) => elementTypeName(el) === 'Button');
  const connectButton = buttons.find((button) => button.props.label === 'Conectar');
  expect(connectButton?.props.disabled).toBe(true);
}

export function verifyFilledStateEnablesConnect(): void {
  const tree = CredentialForm({
    ...credentialFormBaseProps(),
    rut: '12.345.678-5',
    password: 'clave',
    canConnect: true,
  });
  const buttons = collectElements(tree, (el) => elementTypeName(el) === 'Button');
  const connectButton = buttons.find((button) => button.props.label === 'Conectar');
  expect(connectButton?.props.disabled).toBe(false);
}

export function verifyRutLockedStateLocksRutField(): void {
  const tree = CredentialForm({ ...credentialFormBaseProps(), rut: '12.345.678-5', locked: true });
  const fields = credentialFormTextFields(tree);
  const rutField = fields.find((field) => field.props.label === 'RUT');
  expect(rutField?.props.locked).toBe(true);
  expect(rutField?.props.hint).toBe('Todos tus bancos deben estar a nombre del mismo RUT.');

  const passwordField = fields.find((field) => field.props.label === 'Clave de internet');
  expect(passwordField?.props.locked).toBeFalsy();
}

export function verifyErrorStateShowsGenericRejection(): void {
  const typedPassword = 'ZZSENTINELPASSZZ';
  const tree = CredentialForm({
    ...credentialFormBaseProps(),
    password: typedPassword,
    errorMessage: 'El banco rechazó estas credenciales. Revisa tu clave e inténtalo de nuevo.',
  });
  const fields = credentialFormTextFields(tree);
  const passwordField = fields.find((field) => field.props.label === 'Clave de internet');
  expect(passwordField?.props.error).toBe(
    'El banco rechazó estas credenciales. Revisa tu clave e inténtalo de nuevo.',
  );
  expect(passwordField?.props.error).not.toContain(typedPassword);
}

const CONNECTED_BANK_COPY: ConnectedBankSummaryCopy = {
  headingSingle: '¡Banco conectado!',
  headingMultiple: '¡Bancos conectados!',
  congratulation: 'Excelente.',
  productsCount: (count) => (count === 1 ? `${count} producto` : `${count} productos`),
  movementsCount: (count) => (count === 1 ? `${count} movimiento` : `${count} movimientos`),
};

const CONNECTED_BANK_ONE: ConnectedBankSummary = {
  id: 'connection-1',
  institutionName: 'Banco de Chile',
  institutionShortName: 'BCH',
  // style-literal-allow: institutionBrandColor is a ConnectedBankSummary fixture value (test data), not a style prop
  institutionBrandColor: '#003da5',
  productCount: 3,
  movementCount: 57,
};

const CONNECTED_BANK_TWO: ConnectedBankSummary = {
  id: 'connection-2',
  institutionName: 'Banco Santander',
  institutionShortName: 'SAN',
  // style-literal-allow: institutionBrandColor is a ConnectedBankSummary fixture value (test data), not a style prop
  institutionBrandColor: '#ec0000',
  productCount: 1,
  movementCount: 1,
};

export function verifySingleStateShowsOneRow(): void {
  const tree = ConnectedBankSummaryList({ connections: [CONNECTED_BANK_ONE], copy: CONNECTED_BANK_COPY });
  const heading = collectElements(tree, (el) => elementTypeName(el) === 'Text')[0];
  expect(heading?.props.children).toBe('¡Banco conectado!');

  const rows = collectElements(tree, (el) => elementTypeName(el) === 'BankRow');
  expect(rows).toHaveLength(1);
  expect(rows[0]?.props.subLabel).toBe('3 productos · 57 movimientos');
}

export function verifyMultipleStateShowsAllRows(): void {
  const tree = ConnectedBankSummaryList({
    connections: [CONNECTED_BANK_ONE, CONNECTED_BANK_TWO],
    copy: CONNECTED_BANK_COPY,
  });
  const heading = collectElements(tree, (el) => elementTypeName(el) === 'Text')[0];
  expect(heading?.props.children).toBe('¡Bancos conectados!');

  const rows = collectElements(tree, (el) => elementTypeName(el) === 'BankRow');
  expect(rows).toHaveLength(2);
  const second = rows.find((row) => row.props.name === 'Banco Santander');
  expect(second?.props.subLabel).toBe('1 producto · 1 movimiento');
}
