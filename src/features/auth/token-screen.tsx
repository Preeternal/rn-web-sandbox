import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

type TTokenScreenProps = {
  notice: string | null;
  onSave: (token: string) => void;
};

export function TokenScreen({ notice, onSave }: TTokenScreenProps) {
  const theme = useTheme();
  const [input, setInput] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = !input.trim();

  const submit = () => {
    try {
      onSave(input);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save your token.');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">API sandbox</ThemedText>
          <ThemedText type="subtitle">Enter your API token</ThemedText>
          <ThemedText themeColor="textSecondary">
            Enter a token to access your API. It will be saved in this browser.
          </ThemedText>
          {notice && <ThemedText accessibilityRole="alert">{notice}</ThemedText>}
          <View style={styles.field}>
            <ThemedText type="smallBold">API token</ThemedText>
            <TextInput
              accessibilityLabel="API token"
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect={false}
              onChangeText={(value) => {
                setInput(value);
                setError(null);
              }}
              onSubmitEditing={submit}
              placeholder="Paste your token"
              placeholderTextColor={theme.textSecondary}
              returnKeyType="done"
              secureTextEntry={!visible}
              style={[styles.input, { color: theme.text, borderColor: theme.textSecondary }]}
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
          {error && <ThemedText accessibilityRole="alert">{error}</ThemedText>}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={submit}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.text, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
            ]}>
            <ThemedText style={{ color: theme.background }}>Save token</ThemedText>
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
  button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
