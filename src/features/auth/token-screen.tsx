import { isCancel } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ApiError } from '@/api/errors';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

type TTokenScreenProps = {
  notice: string | null;
  onSave: (token: string, signal?: AbortSignal) => Promise<void>;
};

export function TokenScreen({ notice, onSave }: TTokenScreenProps) {
  const theme = useTheme();
  const [input, setInput] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [checking, setChecking] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const disabled = checking || !input.trim();

  useEffect(() => () => { pending.current?.abort(); }, []);

  const submit = async () => {
    if (pending.current || !input.trim()) return;
    const controller = new AbortController();
    pending.current = controller;
    setChecking(true);
    setError(null);
    setTokenInvalid(false);
    try {
      await onSave(input, controller.signal);
    } catch (failure) {
      if (controller.signal.aborted || isCancel(failure)) return;
      const invalid = failure instanceof ApiError && failure.status === 401;
      setTokenInvalid(invalid);
      setError(invalid ? 'Invalid or expired token. Check it and try again.'
        : failure instanceof Error ? failure.message : 'Could not verify your token. Try again.');
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        if (!controller.signal.aborted) setChecking(false);
      }
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">API sandbox</ThemedText>
          <ThemedText type="subtitle">Enter your API token</ThemedText>
          <ThemedText themeColor="textSecondary">
            Enter a token to access your API. It will be verified before being saved in this browser.
          </ThemedText>
          {notice && <ThemedText accessibilityRole="alert">{notice}</ThemedText>}
          <View style={styles.field}>
            <ThemedText type="smallBold">API token</ThemedText>
            <TextInput
              accessibilityLabel="API token"
              accessibilityHint={tokenInvalid ? 'Invalid or expired API token.' : undefined}
              editable={!checking}
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect={false}
              onChangeText={(value) => {
                setInput(value);
                setError(null);
                setTokenInvalid(false);
              }}
              onSubmitEditing={submit}
              placeholder="Paste your token"
              placeholderTextColor={theme.textSecondary}
              returnKeyType="done"
              secureTextEntry={!visible}
              style={[styles.input, { color: theme.text, borderColor: tokenInvalid ? theme.error : theme.textSecondary, borderWidth: tokenInvalid ? 2 : 1 }]}
              value={input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={visible ? 'Hide token' : 'Show token'}
              onPress={() => setVisible((value) => !value)}
              style={styles.textButton}>
              <ThemedText type="small">{visible ? 'Hide token' : 'Show token'}</ThemedText>
            </Pressable>
          </View>
          {error && <ThemedText accessibilityRole="alert" style={{ color: theme.error }}>{error}</ThemedText>}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled, busy: checking }}
            disabled={disabled}
            onPress={submit}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.text, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
            ]}>
            {checking && <ActivityIndicator size="small" color={theme.background} accessibilityLabel="Verifying token" />}
            <ThemedText style={{ color: theme.background }}>{checking ? 'Verifying…' : 'Save token'}</ThemedText>
          </Pressable>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 440, padding: 24, borderRadius: 16, gap: 20 },
  field: { gap: 8 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 8 },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
