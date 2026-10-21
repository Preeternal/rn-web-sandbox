import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useClaimQuery } from '@/hooks/api/claims/use-claim-query';

import { useClaimRecovery } from './use-claim-recovery';

export function ClaimNotice() {
  const recovery = useClaimRecovery();
  const operation = recovery.data?.operation;
  const query = useClaimQuery(operation?.claim?.id);
  if (!operation && !recovery.isError) return null;
  const claim = operation?.claim?.status !== 'pending' && operation?.claim ? operation.claim : query.data ?? operation?.claim;
  return (
    <ThemedView type="backgroundElement" style={styles.notice}>
      <ThemedText type="smallBold">{recovery.isError ? 'Claim recovery needs attention' : claim ? `Claim ${claim.status}` : operation?.rejection ? 'Claim rejected' : 'Claim outcome not confirmed'}</ThemedText>
      {operation && <ThemedText>{operation.payload.amount} {operation.payload.asset} · {operation.destinationLabel}</ThemedText>}
      <ThemedText type="small">View the saved operation before starting another claim. Your balance is still the server’s snapshot.</ThemedText>
      <Link href="/claim" asChild>
        <Pressable accessibilityRole="link" style={styles.link}><ThemedText type="smallBold">View claim</ThemedText></Pressable>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({ notice: { padding: 20, borderRadius: 16, gap: 8 }, link: { minHeight: 48, justifyContent: 'center' } });
