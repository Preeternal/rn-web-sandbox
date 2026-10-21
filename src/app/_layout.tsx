import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';

import { setupAxios } from '@/api/axios';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { restoreSession } from '@/features/auth/session';
import { SessionQueries } from '@/features/auth/session-queries';
import { useSession } from '@/features/auth/use-session';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const session = useSession();

  useEffect(() => {
    const dispose = setupAxios();
    restoreSession();
    return dispose;
  }, []);

  if (!session.ready) {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator accessibilityLabel="Loading session" />
        <ThemedText>Loading session…</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SessionQueries key={session.version}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!!session.token}>
            <Stack.Screen name="index" options={{ title: 'Home' }} />
          </Stack.Protected>
          <Stack.Protected guard={!session.token}>
            <Stack.Screen name="auth" options={{ title: 'Auth' }} />
          </Stack.Protected>
        </Stack>
      </SessionQueries>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
});
