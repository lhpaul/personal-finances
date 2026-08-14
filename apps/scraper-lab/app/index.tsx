import { BANK_CONFIGS } from '@finanzas/bank-scraper';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BanksScreen() {
  const { t } = useTranslation();
  const banks = BANK_CONFIGS.cl ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('lab.title')}</Text>
        <Text style={styles.subtitle}>{t('lab.subtitle')}</Text>
        <Text style={styles.heading}>{t('lab.banksHeading')}</Text>
        {banks.map((bank) => (
          <Pressable
            key={bank.id}
            style={styles.row}
            onPress={() =>
              router.push({ pathname: '/credentials', params: { bankId: bank.id, country: 'cl' } })
            }
          >
            <Text style={styles.bankName}>{bank.name}</Text>
            <Text style={styles.bankId}>{bank.id}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 24 },
  heading: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  row: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  bankName: { fontSize: 18, fontWeight: '600' },
  bankId: { fontSize: 13, color: '#666', marginTop: 4 },
});
