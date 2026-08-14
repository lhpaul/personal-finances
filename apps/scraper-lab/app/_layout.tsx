import '../src/i18n';

import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ResultsProvider } from '../src/results-context';

export default function RootLayout() {
  const { t } = useTranslation();
  return (
    <SafeAreaProvider>
      <ResultsProvider>
        <Stack>
          <Stack.Screen name="index" options={{ title: t('lab.title') }} />
          <Stack.Screen name="credentials" options={{ title: t('lab.credentialsTitle') }} />
          <Stack.Screen name="results" options={{ title: t('lab.resultsTitle') }} />
        </Stack>
      </ResultsProvider>
    </SafeAreaProvider>
  );
}
