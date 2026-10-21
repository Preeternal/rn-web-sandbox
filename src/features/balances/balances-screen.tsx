import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/errors';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { signOut } from '@/features/auth/session';
import { useBalancesQuery } from '@/hooks/api/balances/use-balances-query';
import { useTheme } from '@/hooks/use-theme';

import { BalanceCard } from './balance-card';
import { formatUsdEstimate } from './format';
import { SnapshotFreshness } from './snapshot-freshness';
import { calculateBalanceUsdTotals } from './totals';

export function BalancesScreen() {
  const theme = useTheme();
  const query = useBalancesQuery();
  const [sessionError, setSessionError] = useState<string | null>(null);
  const totals = query.data ? calculateBalanceUsdTotals(query.data.items) : null;
  const busy = query.isFetching || query.isPaused;
  const errorMessage = query.error instanceof ApiError ? query.error.message : 'Could not load balances. Check your connection and try again.';

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.toolbar}>
            <View style={styles.heading}>
              <ThemedText type="small" themeColor="textSecondary">YOUR PAYBACK</ThemedText>
              <ThemedText type="subtitle" accessibilityRole="header">Balances</ThemedText>
            </View>
            <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => {
              try { signOut(); } catch (error) {
                setSessionError(error instanceof Error ? error.message : 'Could not sign out.');
              }
            }}>
              <ThemedText type="smallBold">Logout</ThemedText>
            </Pressable>
          </View>
          {sessionError && <ThemedText accessibilityRole="alert">{sessionError}</ThemedText>}

          <View style={styles.refreshRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.refreshHint}>
              {query.isPaused ? 'Waiting for a connection…' : query.isFetching ? 'Updating balances…' : 'Updates automatically every 30 seconds'}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={query.isError ? 'Retry loading balances' : 'Refresh balances'}
              accessibilityState={{ disabled: busy, busy }}
              disabled={busy}
              onPress={() => { void query.refetch(); }}
              style={({ pressed }) => [styles.refreshButton, { backgroundColor: theme.backgroundElement, opacity: busy ? 0.5 : pressed ? 0.7 : 1 }]}>
              {query.isFetching && <ActivityIndicator size="small" color={theme.text} accessibilityLabel="Updating balances" />}
              <ThemedText type="smallBold">{query.isPaused ? 'Waiting…' : query.isFetching ? 'Refreshing…' : query.isError ? 'Retry' : 'Refresh'}</ThemedText>
            </Pressable>
          </View>

          {query.isError && (
            <ThemedView type="backgroundElement" style={styles.notice} accessibilityRole="alert">
              <ThemedText type="smallBold">{query.data ? 'Could not refresh balances' : 'Could not load balances'}</ThemedText>
              <ThemedText type="small">{errorMessage}</ThemedText>
              {query.data && <ThemedText type="small">Showing the last received snapshot. These balances may be out of date.</ThemedText>}
              {query.error instanceof ApiError && query.error.status === 429 && (
                <ThemedText type="small">Requests will wait for the server’s retry window.</ThemedText>
              )}
            </ThemedView>
          )}

          {query.isPending && (
            <View style={styles.loading} accessibilityLiveRegion="polite">
              {!query.isPaused && <ActivityIndicator color={theme.text} accessibilityLabel="Loading balances" />}
              <ThemedText themeColor="textSecondary">{query.isPaused ? 'Connect to the internet to load your balances.' : 'Loading your balances…'}</ThemedText>
            </View>
          )}

          {query.data && totals && (
            <>
              <ThemedView type="backgroundElement" style={styles.summary}>
                <ThemedText type="smallBold">TOTAL PAYBACK · USD ESTIMATE</ThemedText>
                <ThemedText selectable accessibilityLabel={`Total payback ${totals.totalUsd} USD`} style={styles.total}>
                  ≈ {formatUsdEstimate(totals.totalUsd)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Includes available, pending confirmation, and claiming balances.</ThemedText>
                <View style={styles.subtotals}>
                  <View style={styles.subtotal}>
                    <ThemedText type="small" themeColor="textSecondary">Available</ThemedText>
                    <ThemedText type="smallBold">{formatUsdEstimate(totals.availableUsd)}</ThemedText>
                  </View>
                  <View style={styles.subtotal}>
                    <ThemedText type="small" themeColor="textSecondary">Pending</ThemedText>
                    <ThemedText type="smallBold">{formatUsdEstimate(totals.pendingUsd)}</ThemedText>
                  </View>
                  <View style={styles.subtotal}>
                    <ThemedText type="small" themeColor="textSecondary">Claiming</ThemedText>
                    <ThemedText type="smallBold">{formatUsdEstimate(totals.claimingUsd)}</ThemedText>
                  </View>
                </View>
              </ThemedView>
              <SnapshotFreshness asOf={query.data.asOf} />
              {query.data.items.length === 0 ? (
                <ThemedView type="backgroundElement" style={styles.notice}>
                  <ThemedText style={styles.sectionHeading}>No balances yet</ThemedText>
                  <ThemedText themeColor="textSecondary">Your payback balances will appear here when they are available.</ThemedText>
                </ThemedView>
              ) : (
                <View style={styles.assets}>
                  <ThemedText accessibilityRole="header" style={styles.sectionHeading}>Your assets</ThemedText>
                  {query.data.items.map((balance) => <BalanceCard key={balance.asset} balance={balance} />)}
                </View>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                Pending payback is awaiting confirmation. Claiming funds are reserved for a claim in progress. USD values are approximate; asset amounts are exact.
              </ThemedText>
            </>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 20, paddingBottom: 48 },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center', gap: 20 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heading: { gap: 4 },
  textButton: { minHeight: 48, paddingHorizontal: 8, justifyContent: 'center' },
  refreshRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  refreshHint: { flex: 1, minWidth: 140 },
  refreshButton: { minHeight: 48, paddingHorizontal: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  summary: { padding: 20, borderRadius: 16, gap: 12 },
  total: { fontSize: 36, lineHeight: 44, fontWeight: '600', fontVariant: ['tabular-nums'] },
  subtotals: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, paddingTop: 8 },
  subtotal: { gap: 4, flexGrow: 1 },
  notice: { padding: 20, borderRadius: 16, gap: 8 },
  loading: { paddingVertical: 64, alignItems: 'center', gap: 16 },
  assets: { gap: 12 },
  sectionHeading: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
});
