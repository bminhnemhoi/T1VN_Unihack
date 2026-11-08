'use client';

import type { ComponentProps } from 'react';
import { SOON_MESSAGE, useToast } from '@/components/shell/Toast';
import { Button } from '@/components/ui/button';

/** A button for something that needs a wallet or the network. It is never dead: it answers right away. */
export function SoonButton({ message = SOON_MESSAGE, onClick, ...props }: ComponentProps<typeof Button> & { message?: string }) {
  const { show } = useToast();
  return (
    <Button
      type="button"
      {...props}
      onClick={(e) => {
        onClick?.(e);
        show(message);
      }}
    />
  );
}
