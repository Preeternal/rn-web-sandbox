import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type TClaimDetailsProps = {
  asset: string;
  amount: string;
  fee: string;
  receiveAmount: string;
  destinationLabel: string;
};

export function ClaimDetails({ asset, amount, fee, receiveAmount, destinationLabel }: TClaimDetailsProps) {
  return (
    <View style={styles.container}>
      <ThemedText selectable>Claim amount: {amount} {asset}</ThemedText>
      <ThemedText selectable>Fee: {fee} {asset}</ThemedText>
      <ThemedText selectable style={styles.receive}>You receive: {receiveAmount} {asset}</ThemedText>
      <ThemedText>Destination: {destinationLabel}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({ container: { gap: 8 }, receive: { fontWeight: '700' } });
