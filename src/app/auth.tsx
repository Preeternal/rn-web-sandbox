import { saveToken } from '@/features/auth/session';
import { TokenScreen } from '@/features/auth/token-screen';
import { useSession } from '@/features/auth/use-session';

export default function AuthScreen() {
  const session = useSession();

  return (
    <TokenScreen
      key={session.version}
      notice={session.notice}
      onSave={saveToken}
    />
  );
}
