import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type PropsWithChildren, useEffect, useState } from 'react';

import QueryDevtools from '@/components/query-devtools';

export function SessionQueries({ children }: PropsWithChildren) {
  const [client] = useState(() => new QueryClient());

  useEffect(() => () => {
    void client.cancelQueries();
    client.clear();
  }, [client]);

  return (
    <QueryClientProvider client={client}>
      {children}
      {__DEV__ && <QueryDevtools />}
    </QueryClientProvider>
  );
}
