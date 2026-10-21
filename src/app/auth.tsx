import { TokenScreen } from '@/features/auth/token-screen';
import { useSession } from '@/features/auth/use-session';
import { verifyAndSaveToken } from '@/features/auth/verify-token';

export default function AuthScreen() {
  const session = useSession();

  return (
    <TokenScreen
      key={session.version}
      notice={session.notice}
      onSave={verifyAndSaveToken}
    />
  );
}
