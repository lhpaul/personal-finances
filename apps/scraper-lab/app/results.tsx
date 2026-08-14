import { formatClp } from '@finanzas/shared-utils';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useResults } from '../src/results-context';

export default function ResultsScreen() {
  const { t } = useTranslation();
  const { result } = useResults();

  if (!result) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>{t('lab.noResult')}</Text>
        <Pressable onPress={() => router.back()}>
          <Text>{t('lab.back')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('lab.resultsTitle')}</Text>
        <Text style={styles.meta}>
          {t('lab.outcomeValue', { outcome: result.outcome, bankId: result.bankId })}
        </Text>
        {result.readFailure ? (
          <Text style={styles.meta}>
            {t('lab.failureReason', { reason: result.readFailure.reasonCode })}
          </Text>
        ) : null}
        <Text style={styles.heading}>{t('lab.products')}</Text>
        {result.products.map((product) => (
          <View key={product.instanceId} style={styles.card}>
            <Text style={styles.cardTitle}>{product.displayName}</Text>
            <Text>{product.kind}</Text>
            <Text>{product.maskedIdentifier}</Text>
            {product.balanceMinorUnits !== undefined ? (
              <Text>{formatClp(product.balanceMinorUnits)}</Text>
            ) : null}
          </View>
        ))}
        <Text style={styles.heading}>{t('lab.movements')}</Text>
        {result.movements.map((movement, index) => (
          <View key={`${movement.productInstanceId}-${movement.positionInReadSnapshot}-${index}`} style={styles.card}>
            <Text>{movement.dateLocal}</Text>
            <Text>{movement.rawDescription}</Text>
            <Text>
              {movement.direction} {formatClp(movement.amountMinorUnits)} {movement.currencyCode}
            </Text>
          </View>
        ))}
        <Text style={styles.heading}>{t('lab.traces')}</Text>
        {result.traces.map((trace, index) => (
          <View key={`${trace.timestamp}-${index}`} style={styles.card}>
            <Text style={styles.trace}>
              {t('lab.traceLine', {
                group: trace.logGroup ?? '',
                type: trace.type,
                message: trace.message,
              })}
            </Text>
            {trace.data ? <Text style={styles.traceData}>{JSON.stringify(trace.data)}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  meta: { color: '#555', marginBottom: 16 },
  heading: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  cardTitle: { fontWeight: '600', marginBottom: 4 },
  trace: { fontSize: 12, color: '#444', marginBottom: 4 },
  traceData: { fontSize: 12, color: '#111', fontFamily: 'Courier' },
});
