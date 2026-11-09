'use client';
/**
 * Read-side provider: the chain config (public client, addresses) plus a TanStack Query client. The server layout
 * calls `loadChainConfig()` and passes the JSON here; `null` means "not deployed", hooks then stay disabled.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createChainConfig, type ChainConfig, type ChainConfigJson } from './config';

const Ctx = createContext<ChainConfig | null>(null);

export function ChainProvider({
  config,
  children,
}: {
  config: ChainConfigJson | null;
  children: ReactNode;
}) {
  const built = useMemo(() => (config ? createChainConfig(config) : null), [config]);
  const qc = useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 2_000 } } }), []);
  return (
    <QueryClientProvider client={qc}>
      <Ctx.Provider value={built}>{children}</Ctx.Provider>
    </QueryClientProvider>
  );
}

/** The chain config, or `null` when nothing is deployed on this network. */
export function useChain(): ChainConfig | null {
  return useContext(Ctx);
}
