import { useCallback, useEffect, useState } from 'react';

import { BANK_CONFIGS, resolveBankConfigOrReject, type BankConfig, type ScraperStepId } from '@finanzas/bank-scraper';
import { BankScraperComponent } from '@finanzas/bank-scraper/src/component';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { applyFieldFormatter } from '../src/lib/apply-field-formatter';
import {
  deleteCredentials,
  readCredentials,
  writeCredentials,
} from '../src/lib/secure-store/credential-store';
import { expoSecureStoreAdapter } from '../src/lib/secure-store/expo-secure-store.adapter';
import { useResults } from '../src/results-context';

function resolveBank(countryCode: string, bankId: string): BankConfig | null {
  const resolved = resolveBankConfigOrReject(BANK_CONFIGS, countryCode, bankId);
  return 'reason' in resolved ? null : resolved;
}

export default function CredentialsScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ bankId?: string; country?: string }>();
  const countryCode = params.country ?? 'cl';
  const bankId = typeof params.bankId === 'string' ? params.bankId : '';
  const bank = resolveBank(countryCode, bankId);
  const { setResult } = useResults();

  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [stepId, setStepId] = useState<ScraperStepId | null>(null);
  const [debugVisible, setDebugVisible] = useState(true);

  useEffect(() => {
    if (!bank) return;
    const initial: Record<string, string> = {};
    for (const field of bank.fields) {
      initial[field.id] = '';
    }
    void readCredentials(expoSecureStoreAdapter, bank.id).then((saved) => {
      setCredentials(saved ?? initial);
    });
  }, [bank]);

  const onChangeField = useCallback(
    (fieldId: string, value: string) => {
      const field = bank?.fields.find((candidate) => candidate.id === fieldId);
      const next = applyFieldFormatter(field?.formatter, value);
      setCredentials((prev) => ({ ...prev, [fieldId]: next }));
    },
    [bank],
  );

  if (!bank) {
    return (
      <SafeAreaView style={styles.container}>
        <Pressable onPress={() => router.back()}>
          <Text>{t('lab.back')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} scrollEnabled={!running}>
        <Text style={styles.title}>{bank.name}</Text>
        {bank.fields.map((field) => (
          <View key={field.id} style={styles.field}>
            <Text style={styles.label}>{field.label}</Text>
            <TextInput
              value={credentials[field.id] ?? ''}
              onChangeText={(value) => onChangeField(field.id, value)}
              placeholder={field.placeholder}
              secureTextEntry={field.type === 'password'}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={field.maxLength}
              keyboardType={field.keyboardType === 'numeric' ? 'number-pad' : 'default'}
              style={styles.input}
              editable={!running}
            />
          </View>
        ))}
        <Pressable
          style={styles.checkbox}
          onPress={() => setDebugVisible((value) => !value)}
          disabled={running}
        >
          <Text>
            {t('lab.showWebViewState', {
              state: debugVisible ? t('lab.toggleOn') : t('lab.toggleOff'),
            })}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.button, running && styles.buttonDisabled]}
          disabled={running}
          onPress={() => {
            setRunning(true);
            setStepId('load-start');
            void writeCredentials(expoSecureStoreAdapter, bank.id, credentials);
          }}
        >
          <Text style={styles.buttonLabel}>{running ? t('lab.running') : t('lab.startRead')}</Text>
        </Pressable>
        {stepId ? (
          <Text style={styles.step}>
            {t('lab.stepValue', { step: stepId })}
          </Text>
        ) : null}
        <Pressable
          style={styles.secondary}
          disabled={running}
          onPress={() => {
            void deleteCredentials(expoSecureStoreAdapter, bank.id);
            const cleared: Record<string, string> = {};
            for (const field of bank.fields) cleared[field.id] = '';
            setCredentials(cleared);
          }}
        >
          <Text>{t('lab.clearSaved')}</Text>
        </Pressable>
      </ScrollView>
      {running ? (
        <BankScraperComponent
          config={bank}
          credentials={credentials}
          debugVisible={debugVisible}
          onProgress={(progress) => setStepId(progress.stepId)}
          onResult={(result) => {
            setRunning(false);
            setResult(result);
            router.push('/results');
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  field: { marginBottom: 12 },
  label: { fontSize: 14, marginBottom: 4 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  checkbox: { paddingVertical: 12 },
  button: {
    backgroundColor: '#003da5',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonLabel: { color: '#fff', fontWeight: '600', fontSize: 16 },
  step: { marginTop: 12, color: '#333' },
  secondary: { marginTop: 16, alignItems: 'center' },
});
