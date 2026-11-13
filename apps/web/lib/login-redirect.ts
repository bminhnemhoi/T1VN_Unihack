/**
 * Where /dang-nhap sends someone who is already signed in: back to the invite they came from, otherwise their circles.
 * Returns null while they still have to sign in (loading, logged out, no wallet yet).
 */
export function loginRedirect(status: string, hasWallet: boolean, back?: string): string | null {
  if (status !== 'ready' || !hasWallet) return null;
  return back ?? '/circles';
}
