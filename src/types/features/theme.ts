import type { Colors } from '@/constants/theme';

export type TThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
