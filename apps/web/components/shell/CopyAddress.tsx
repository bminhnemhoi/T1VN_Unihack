'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/shell/Toast';
import { copyAddress } from '@/lib/copy-address';

/** Copies a wallet address and says so (see `lib/copy-address.ts`). Returns true when clipboard write succeeded. */
export function useCopyAddress(): (address: string) => Promise<boolean> {
  const { show } = useToast();
  return (address) => copyAddress(address, (t) => navigator.clipboard.writeText(t), show);
}

/** The full-width way to copy the wallet address, used on the settings page at every screen width. */
export function CopyAddressButton({ address }: { address: string }) {
  const copy = useCopyAddress();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);
  const onCopy = async () => {
    const ok = await copy(address);
    if (!ok) return;
    setCopied(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <Button type="button" size="lg" onClick={() => void onCopy()} data-testid="copy-address">
      {copied ? <Check aria-hidden className="size-5" /> : <Copy aria-hidden className="size-5" />}
      {copied ? 'Đã sao chép địa chỉ ví' : 'Sao chép địa chỉ ví'}
    </Button>
  );
}
