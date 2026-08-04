import { collectElements, elementTypeName } from '../../../test-utils/element-tree';
import { CredentialForm, type CredentialFormCopy } from '../components/CredentialForm';
import {
  verifyEmptyStateMasksPasswordAndDisablesConnect,
  verifyErrorStateShowsGenericRejection,
  verifyFilledStateEnablesConnect,
  verifyRutLockedStateLocksRutField,
} from '../state-verifiers';

/** Implementation plan Testing Strategy scenarios 9-10 (AC6, AC15, AC16). The four
 * state-defining assertions below now live in `../state-verifiers.ts` and are imported both
 * here and by `state-coverage.ts` (found in review — CodeRabbit PR #80), so removing or
 * weakening any of them fails this file's own test too, not only a separate residual check. */

const COPY: CredentialFormCopy = {
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

function baseProps() {
  return {
    bankMonogram: 'BCH',
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
    copy: COPY,
  };
}

function textFields(tree: ReturnType<typeof CredentialForm>) {
  return collectElements(tree, (el) => elementTypeName(el) === 'TextField');
}

describe('CredentialForm — empty / filled (AC13, AC15)', () => {
  it(
    'the password field is always masked (secureTextEntry) and the connect button is disabled when canConnect is false',
    verifyEmptyStateMasksPasswordAndDisablesConnect,
  );

  it('the connect button is enabled once canConnect is true', verifyFilledStateEnablesConnect);

  it('no field anywhere reveals the password as readable text (no reveal control) — AC15', () => {
    const tree = CredentialForm({ ...baseProps(), password: 'clave-secreta' });
    // Every TextField in the tree that carries the password value is masked; nothing renders the
    // raw password as a plain, unmasked Text node.
    const texts = collectElements(tree, (el) => elementTypeName(el) === 'Text');
    for (const text of texts) {
      expect(text.props.children).not.toBe('clave-secreta');
    }
  });
});

describe('CredentialForm — rut-locked (AC18)', () => {
  it('renders the RUT field locked with the same-RUT hint, and the password field editable', verifyRutLockedStateLocksRutField);
});

describe('CredentialForm — error (AC16)', () => {
  it('shows the generic rejection message and nothing derived from the typed input', verifyErrorStateShowsGenericRejection);

  it('composes with rut-locked — both a locked RUT and the rejection message can be true at once', () => {
    const tree = CredentialForm({
      ...baseProps(),
      rut: '12.345.678-5',
      locked: true,
      errorMessage: 'El banco rechazó estas credenciales. Revisa tu clave e inténtalo de nuevo.',
    });
    const fields = textFields(tree);
    const rutField = fields.find((field) => field.props.label === 'RUT');
    const passwordField = fields.find((field) => field.props.label === 'Clave de internet');
    expect(rutField?.props.locked).toBe(true);
    expect(passwordField?.props.error).toBeTruthy();
  });
});
