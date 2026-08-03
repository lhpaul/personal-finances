import { View } from 'react-native';

import { Button, Note, Text, TextField } from '../../../components/ui';
import { theme } from '../../../theme';

/** Decorative glyph, not user-facing copy (implementation plan Decision 10 precedent). */
const LOCK_GLYPH = '🔒';

/** Every visible string, pre-resolved by the caller — this component calls no hook, so it stays
 * directly callable for a renderer-free element-tree assertion. */
export interface CredentialFormCopy {
  subtitle: string;
  privacyNote: string;
  rutLabel: string;
  rutPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  rutLockedHint: string;
  connectCta: string;
  cancelCta: string;
}

export interface CredentialFormProps {
  bankMonogram: string;
  bankMonogramColor: string;
  bankName: string;
  rut: string;
  onChangeRut: (value: string) => void;
  password: string;
  onChangePassword: (value: string) => void;
  /** `rut-locked` (Business Rule 13) — the RUT field is pre-filled and cannot be edited. */
  locked: boolean;
  /** `error` — the generic rejection message, value-free (Business Rules 1, 4). `undefined` in
   * every other state. */
  errorMessage: string | undefined;
  canConnect: boolean;
  onConnect: () => void;
  onCancel: () => void;
  copy: CredentialFormCopy;
}

/**
 * `bank-credentials`'s body (`empty`, `filled`, `error`, `rut-locked`, and `rut-locked` composed
 * with `error` — spec UX Rules `bank-credentials`) — pure presentational, so it is directly
 * callable for a renderer-free element-tree assertion (Testing Strategy scenarios 9-10).
 */
export function CredentialForm({
  bankMonogram,
  bankMonogramColor,
  bankName,
  rut,
  onChangeRut,
  password,
  onChangePassword,
  locked,
  errorMessage,
  canConnect,
  onConnect,
  onCancel,
  copy,
}: CredentialFormProps) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space['3'] }}>
        <View
          style={{
            width: theme.space['12'],
            height: theme.space['12'],
            borderRadius: theme.radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: bankMonogramColor,
          }}
        >
          <Text tone="inverse" style={{ fontSize: theme.typography.size.base }}>
            {bankMonogram}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h3">{bankName}</Text>
          <Text variant="small">{copy.subtitle}</Text>
        </View>
      </View>

      <View style={{ marginTop: theme.space['4'] }}>
        <Note tone="ok" icon={LOCK_GLYPH}>
          {copy.privacyNote}
        </Note>
      </View>

      <TextField
        label={copy.rutLabel}
        value={rut}
        onChangeText={onChangeRut}
        placeholder={copy.rutPlaceholder}
        locked={locked}
        hint={locked ? copy.rutLockedHint : undefined}
      />

      <TextField
        label={copy.passwordLabel}
        value={password}
        onChangeText={onChangePassword}
        placeholder={copy.passwordPlaceholder}
        secureTextEntry
        error={errorMessage ?? null}
      />

      <View style={{ marginTop: theme.space['5'] }}>
        <Button
          variant={canConnect ? 'primary' : 'muted'}
          label={copy.connectCta}
          onPress={onConnect}
          disabled={!canConnect}
        />
        <View style={{ marginTop: theme.space['2'] }}>
          <Button variant="ghost" label={copy.cancelCta} onPress={onCancel} />
        </View>
      </View>
    </View>
  );
}
