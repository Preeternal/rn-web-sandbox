import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type TSnapshotFreshnessProps = { asOf: string };

export function SnapshotFreshness({ asOf }: TSnapshotFreshnessProps) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const ageSeconds = Math.max(0, Math.floor((now - Date.parse(asOf)) / 1000));
  const age = ageSeconds < 60 ? `${ageSeconds}s ago` : `${Math.floor(ageSeconds / 60)}m ${ageSeconds % 60}s ago`;
  const timestamp = new Date(asOf).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC',
  });

  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">Snapshot: {timestamp} UTC · {age}</ThemedText>
      {ageSeconds >= 60 && <ThemedText type="small">This snapshot is over a minute old. Refresh for the latest balances.</ThemedText>}
    </View>
  );
}

const styles = StyleSheet.create({ container: { gap: 4 } });
