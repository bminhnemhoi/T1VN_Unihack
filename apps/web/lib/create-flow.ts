/**
 * "Tạo dây" sends two transactions: `createCircle`, then `depositBond` into the new circle. If the second one fails,
 * retrying must not create a second circle (audit B22 L-01): once the factory has returned an address, a retry only
 * deposits the bond into that same circle. Pure so it can be tested without a browser.
 */
type Hex = `0x${string}`;
type Ok = { ok: true; txHash: Hex };
type Fail = { ok: false; code: string; message: string };

export interface CreateFlowActions<I> {
  createCircle: (input: I) => Promise<(Ok & { circle: Hex }) | Fail>;
  depositBond: (circle: Hex, amount: bigint) => Promise<Ok | Fail>;
}

export async function createThenDeposit<I>(
  a: CreateFlowActions<I>,
  input: () => Promise<I>,
  bond: bigint,
  /** Address of the circle a previous attempt already created, if any. */
  existing: Hex | undefined,
  /** Called as soon as a new circle exists, so the caller can keep its address for a retry. */
  onCreated: (circle: Hex) => void,
): Promise<Ok | Fail> {
  let circle = existing;
  if (!circle) {
    const created = await a.createCircle(await input());
    if (!created.ok) return created;
    circle = created.circle;
    onCreated(circle);
  }
  const dep = await a.depositBond(circle, bond);
  if (!dep.ok) {
    return { ok: false, code: dep.code, message: `Dây đã tạo nhưng chưa nạp được ký quỹ: ${dep.message} Bấm "Nạp lại ký quỹ" để nạp vào chính dây này.` };
  }
  return dep;
}
