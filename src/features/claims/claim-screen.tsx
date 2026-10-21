import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

import { SnapshotFreshness } from '../balances/snapshot-freshness';
import { ClaimDetails } from './claim-details';
import { ClaimForm } from './claim-form';
import { useClaimFlow } from './use-claim-flow';

type TClaimScreenProps = { initialAsset?: string };

export function ClaimScreen({ initialAsset }: TClaimScreenProps) {
  const theme = useTheme();
  const flow = useClaimFlow();
  const operation = flow.operation;
  const claim = operation?.claim?.status !== 'pending' && operation?.claim ? operation.claim : flow.status.data ?? operation?.claim;
  const settled = claim?.status === 'completed' || claim?.status === 'failed';
  const loading = flow.recovery.isPending || (!operation && flow.balances.isPending);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Link href="/balances" dismissTo asChild>
            <Pressable accessibilityRole="link" style={styles.back}><ThemedText type="smallBold">Back to balances</ThemedText></Pressable>
          </Link>
          <ThemedText type="subtitle" accessibilityRole="header">Claim payback</ThemedText>
          {loading && <ActivityIndicator color={theme.text} accessibilityLabel="Loading claim" />}
          {flow.error && <ThemedText accessibilityRole="alert" themeColor="error">{flow.error}</ThemedText>}
          {flow.recovery.isError && (
            <>
              <ThemedText accessibilityRole="alert" themeColor="error">{flow.recovery.error.message} Recovery must work before a new claim can be sent.</ThemedText>
              <ActionButton label="Retry recovery" secondary onPress={() => { void flow.recovery.refetch(); }} busy={flow.recovery.isFetching} />
            </>
          )}
          {flow.balances.isError && (
            <>
              <ThemedText accessibilityRole="alert">Could not refresh balances. Previously received amounts may be out of date.</ThemedText>
              <ActionButton label="Retry balances" secondary onPress={() => { void flow.balances.refetch(); }} busy={flow.balances.isFetching} />
            </>
          )}

          {operation ? (
            <ThemedView type="backgroundElement" style={styles.operation}>
              <ThemedText accessibilityRole="header" style={styles.status}>
                {flow.busy ? flow.paused ? 'Waiting for a connection' : 'Submitting claim…'
                  : claim ? `Claim ${claim.status}` : operation.rejection ? 'Claim rejected' : 'Outcome not confirmed'}
              </ThemedText>
              <ClaimDetails asset={operation.payload.asset} amount={claim?.amount ?? operation.payload.amount}
                fee={claim?.fee ?? operation.fee} receiveAmount={claim?.receiveAmount ?? operation.receiveAmount}
                destinationLabel={operation.destinationLabel} />
              {claim && <ThemedText selectable type="small">Claim ID: {claim.id}</ThemedText>}
              {claim?.status === 'pending' && <ThemedText>The amount is reserved on the server. We are checking this claim until it completes or fails.</ThemedText>}
              {claim?.status === 'completed' && <ThemedText>Your claim completed successfully.</ThemedText>}
              {claim?.status === 'failed' && <ThemedText accessibilityRole="alert" themeColor="error">{claim.failureReason ?? 'The claim failed.'} The amount is returned to your available balance.</ThemedText>}
              {operation.rejection && <ThemedText accessibilityRole="alert" themeColor="error">{operation.rejection}</ThemedText>}
              {!claim && !operation.rejection && (
                <>
                  <ThemedText>The request may have reached the server. Check its outcome using the saved request and the same idempotency key.</ThemedText>
                  {operation.errorMessage && <ThemedText type="small">{operation.errorMessage}</ThemedText>}
                  <ActionButton label="Check claim outcome" onPress={flow.recover} busy={flow.busy} />
                </>
              )}
              {flow.status.isError && (
                <>
                  <ThemedText accessibilityRole="alert">Could not update the claim status. This does not mean the claim failed.</ThemedText>
                  <ActionButton label="Retry status check" secondary onPress={() => { void flow.status.refetch(); }} busy={flow.status.isFetching} />
                </>
              )}
              {settled && !flow.canFinish && (
                <>
                  <ThemedText>Waiting for a newer server balance snapshot before another claim is allowed.</ThemedText>
                  <ActionButton label="Refresh balances" secondary onPress={() => { void flow.balances.refetch(); }} busy={flow.balances.isFetching} />
                </>
              )}
              {flow.balances.data && <SnapshotFreshness asOf={flow.balances.data.asOf} />}
              {(settled || operation.rejection) && <ActionButton label="Start another claim" onPress={flow.finish} disabled={!flow.canFinish} busy={flow.busy} />}
              <ThemedText type="small" themeColor="textSecondary">One claim at a time. Your displayed balance remains the server’s snapshot.</ThemedText>
            </ThemedView>
          ) : !loading && !flow.recovery.isError && flow.balances.data ? (
            <ClaimForm balances={flow.balances.data.items} initialAsset={initialAsset}
              disabled={flow.busy || flow.balances.isError || flow.recovery.isFetching} onSubmit={flow.submit} />
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, scroll: { flexGrow: 1, padding: 20, paddingBottom: 48 },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: 20 },
  back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  operation: { padding: 20, borderRadius: 16, gap: 16 }, status: { fontSize: 24, lineHeight: 32, fontWeight: '600' },
});
