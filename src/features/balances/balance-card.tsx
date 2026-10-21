import { Link } from 'expo-router';
import { StyleSheet, View, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { TBalance } from '@/types/entities/balance';

import { formatUsdEstimate } from './format';
import { calculateBalanceUsdTotals } from './totals';

type TBalanceCardProps = { balance: TBalance };

export function BalanceCard({ balance }: TBalanceCardProps) {
  const totals = calculateBalanceUsdTotals([balance]);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <ThemedText style={styles.asset} accessibilityRole="header">{balance.asset}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">≈ {formatUsdEstimate(totals.totalUsd)} total</ThemedText>
      </View>
      <View style={styles.available}>
        <ThemedText type="small" themeColor="textSecondary">Available to claim</ThemedText>
        <ThemedText selectable style={styles.amount}>{balance.available} {balance.asset}</ThemedText>
      </View>
      <View style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">Pending confirmation</ThemedText>
        <ThemedText selectable type="smallBold" style={styles.rowAmount}>{balance.pending} {balance.asset}</ThemedText>
      </View>
      <View style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">Claiming</ThemedText>
        <ThemedText selectable type="smallBold" style={styles.rowAmount}>{balance.claiming} {balance.asset}</ThemedText>
      </View>
      <Link href={{ pathname: '/claim', params: { asset: balance.asset } }} asChild>
        <Pressable accessibilityRole="link" style={styles.claimLink}>
          <ThemedText type="smallBold">Claim {balance.asset}</ThemedText>
        </Pressable>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: 16, gap: 16 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  asset: { fontSize: 20, lineHeight: 28, fontWeight: '700', flexShrink: 1 },
  available: { gap: 4 },
  amount: { fontSize: 24, lineHeight: 32, fontWeight: '600', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  rowAmount: { flexShrink: 1, fontVariant: ['tabular-nums'] },
  claimLink: { minHeight: 48, justifyContent: 'center' },
});
