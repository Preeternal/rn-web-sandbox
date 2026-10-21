import { View, type ViewProps } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

import type { TThemeColor } from '@/types/features/theme';

type TThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: TThemeColor;
};

export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: TThemedViewProps) {
  const theme = useTheme();

  return <View style={[{ backgroundColor: theme[type ?? 'background'] }, style]} {...otherProps} />;
}
