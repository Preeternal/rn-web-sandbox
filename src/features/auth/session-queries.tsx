import { QueryClientProvider } from '@tanstack/react-query';
import { type PropsWithChildren, useEffect, useState } from 'react';

import QueryDevtools from '@/components/query-devtools';

import { createSessionQueryClient } from './session-query-client';

export function SessionQueries({ children }: PropsWithChildren) {
  const [client] = useState(createSessionQueryClient);

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
