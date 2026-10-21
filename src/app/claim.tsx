import { useLocalSearchParams } from 'expo-router';

import { ClaimScreen } from '@/features/claims/claim-screen';

export default function ClaimRoute() {
  const { asset } = useLocalSearchParams<{ asset?: string | string[] }>();
  return <ClaimScreen initialAsset={Array.isArray(asset) ? asset[0] : asset} />;
}
