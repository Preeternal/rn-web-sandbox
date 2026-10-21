import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useClaimOptionsQuery } from '@/hooks/api/claims/use-claim-options-query';
import { useTheme } from '@/hooks/use-theme';
import type { TBalance } from '@/types/entities/balance';
import type { TClaimSubmission } from '@/types/features/claims';

import { getMaxClaimAmount, validateClaimAmount } from './amounts';
import { ClaimDetails } from './claim-details';

type TClaimFormProps = {
  balances: TBalance[];
  initialAsset?: string;
  disabled: boolean;
  onSubmit: (submission: TClaimSubmission) => Promise<void>;
};

export function ClaimForm({ balances, initialAsset, disabled, onSubmit }: TClaimFormProps) {
  const theme = useTheme();
  const [selection, setSelection] = useState(initialAsset);
  const [amount, setAmount] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [confirmation, setConfirmation] = useState<TClaimSubmission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const balance = balances.find((item) => item.asset === selection) ?? balances[0];
  const options = useClaimOptionsQuery(balance?.asset);
  const destination = options.data?.destinations.find((item) => item.id === destinationId)
    ?? (!destinationId ? options.data?.destinations[0] : undefined);
  const validation = balance && options.data ? validateClaimAmount(amount, balance, options.data) : null;
  const blocked = disabled || options.isFetching || options.isError || !destination || !validation?.valid;

  function review() {
    if (blocked || !balance || !validation?.valid || !destination) return;
    setError(null);
    setConfirmation({
      payload: { asset: balance.asset, amount: validation.amount, destinationId: destination.id },
      fee: validation.fee, receiveAmount: validation.receiveAmount, destinationLabel: destination.label,
    });
  }

  async function confirm() {
    if (!confirmation || blocked || !validation?.valid || !balance || !destination) {
      setConfirmation(null);
      setError('Balances or claim options changed. Review the amount again.');
      return;
    }
    if (confirmation.payload.asset !== balance.asset || confirmation.payload.amount !== amount
      || confirmation.payload.destinationId !== destination.id || confirmation.fee !== validation.fee
      || confirmation.receiveAmount !== validation.receiveAmount || confirmation.destinationLabel !== destination.label) {
      setConfirmation(null);
      setError('Claim details changed. Review the amount again.');
      return;
    }
    await onSubmit(confirmation);
  }

  if (!balance) return <ThemedText>No assets are available to claim.</ThemedText>;

  return (
    <View style={styles.container}>
      {error && <ThemedText accessibilityRole="alert" themeColor="error">{error}</ThemedText>}
      {confirmation && validation && !validation.valid && (
        <ThemedText accessibilityRole="alert" themeColor="error">{validation.message} Edit the amount before confirming.</ThemedText>
      )}
      {options.isError && (
        <>
          <ThemedText accessibilityRole="alert" themeColor="error">Could not load claim options. Try again.</ThemedText>
          <ActionButton label="Retry options" secondary onPress={() => { void options.refetch(); }} busy={options.isFetching} />
        </>
      )}
      {confirmation ? (
        <>
          <ThemedText style={styles.title}>Review your claim</ThemedText>
          <ClaimDetails {...confirmation.payload} fee={confirmation.fee} receiveAmount={confirmation.receiveAmount}
            destinationLabel={confirmation.destinationLabel} />
          <ThemedText type="small" themeColor="textSecondary">The fee is deducted from the claim amount. The server checks your available balance when you confirm.</ThemedText>
          <ActionButton label="Confirm claim" onPress={confirm} disabled={blocked} />
          <ActionButton label="Edit amount" secondary onPress={() => setConfirmation(null)} disabled={disabled} />
        </>
      ) : (
        <>
          <ThemedText type="smallBold">Asset</ThemedText>
          <View style={styles.choices} accessibilityRole="radiogroup">
            {balances.map((item) => (
              <Pressable key={item.asset} accessibilityRole="radio" accessibilityState={{ checked: balance.asset === item.asset, disabled }}
                disabled={disabled} onPress={() => { setSelection(item.asset); setAmount(''); setDestinationId(''); setError(null); }}
                style={[styles.choice, { borderColor: item.asset === balance.asset ? theme.text : theme.textSecondary }]}>
                <ThemedText type="smallBold">{item.asset}</ThemedText>
              </Pressable>
            ))}
          </View>
          <ThemedText selectable>Available: {balance.available} {balance.asset}</ThemedText>
          {options.isPending && <ActivityIndicator color={theme.text} accessibilityLabel="Loading claim options" />}
          {options.data && (
            <>
              <ThemedText type="smallBold">Destination</ThemedText>
              {options.data.destinations.length === 0 && <ThemedText>No claim destination is available for this asset.</ThemedText>}
              {options.data.destinations.map((item) => (
                <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: destination?.id === item.id, disabled }}
                  disabled={disabled} onPress={() => setDestinationId(item.id)}
                  style={[styles.choice, { borderColor: destination?.id === item.id ? theme.text : theme.textSecondary }]}>
                  <ThemedText>{item.label}</ThemedText>
                </Pressable>
              ))}
              <ThemedText type="smallBold">Amount ({balance.asset})</ThemedText>
              <TextInput accessibilityLabel={`Claim amount in ${balance.asset}`} value={amount} editable={!disabled}
                keyboardType="decimal-pad" autoCorrect={false} autoCapitalize="none" placeholder="0.00"
                placeholderTextColor={theme.textSecondary}
                onChangeText={(value) => { setAmount(value); setError(null); }}
                style={[styles.input, { color: theme.text, borderColor: amount && validation && !validation.valid ? theme.error : theme.textSecondary }]} />
              <ActionButton label="Max" secondary disabled={disabled} onPress={() => { setAmount(getMaxClaimAmount(balance)); setError(null); }} />
              <ThemedText type="small" themeColor="textSecondary">Minimum: {options.data.minAmount} {balance.asset} · Up to {balance.decimals} decimal places</ThemedText>
              {amount && validation && !validation.valid && <ThemedText accessibilityRole="alert" themeColor="error">{validation.message}</ThemedText>}
              <ThemedView type="backgroundElement" style={styles.preview}>
                <ThemedText>Fee: {options.data.fee} {balance.asset}</ThemedText>
                <ThemedText style={{ fontWeight: '700' }}>You receive: {validation?.valid ? `${validation.receiveAmount} ${balance.asset}` : '—'}</ThemedText>
              </ThemedView>
              <ActionButton label="Review claim" onPress={review} disabled={blocked} />
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 }, title: { fontSize: 24, lineHeight: 32, fontWeight: '600' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 48, padding: 12, borderWidth: 1, borderRadius: 10, justifyContent: 'center' },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 20 },
  preview: { padding: 16, borderRadius: 12, gap: 8 },
});
