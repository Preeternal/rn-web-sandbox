import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { signOut } from '@/features/auth/session';

export default function HomeScreen() {
  const [error, setError] = useState<string | null>(null);

  return (
    <ThemedView style={styles.container}>
      <ThemedView type="backgroundElement">
        <View style={styles.toolbar}>
          <ThemedText type="subtitle">Home</ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              try {
                signOut();
              } catch (failure) {
                setError(failure instanceof Error ? failure.message : 'Could not sign out.');
              }
            }}
            style={styles.action}>
            <ThemedText type="smallBold">Logout</ThemedText>
          </Pressable>
        </View>
        {error && <ThemedText accessibilityRole="alert" style={styles.error}>{error}</ThemedText>}
      </ThemedView>
      <View style={styles.content}>
        <ThemedText themeColor="textSecondary" style={styles.description}>
          Start building your application here.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  description: { maxWidth: 360, textAlign: 'center' },
  toolbar: {
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 8,
  },
  action: { minHeight: 48, justifyContent: 'center' },
  error: { paddingHorizontal: 16, paddingBottom: 12 },
});
