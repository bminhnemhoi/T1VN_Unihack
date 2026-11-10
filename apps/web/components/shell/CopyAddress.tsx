'use client';

import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/shell/Toast';
import { copyAddress } from '@/lib/copy-address';

/** Copies a wallet address and says so (see `lib/copy-address.ts`). */
export function useCopyAddress(): (address: string) => Promise<void> {
  const { show } = useToast();
  return async (address) => {
    await copyAddress(address, (t) => navigator.clipboard.writeText(t), show);
  };
}

/** The full-width way to copy the wallet address, used on the settings page at every screen width. */
export function CopyAddressButton({ address }: { address: string }) {
  const copy = useCopyAddress();
  return (
    <Button type="button" size="lg" onClick={() => void copy(address)} data-testid="copy-address">
      <Copy aria-hidden className="size-5" /> Sao chép địa chỉ ví
    </Button>
  );
}
