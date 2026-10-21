import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

type TActionButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
};

export function ActionButton({ label, onPress, disabled, busy, secondary }: TActionButtonProps) {
  const theme = useTheme();
  const blocked = disabled || busy;
  const color = secondary ? theme.text : theme.background;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!blocked, busy: !!busy }}
      disabled={blocked} onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: secondary ? theme.backgroundElement : theme.text, opacity: blocked ? 0.45 : pressed ? 0.75 : 1 }]}>
      {busy && <ActivityIndicator size="small" color={color} />}
      <ThemedText type="smallBold" style={{ color }}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
});
