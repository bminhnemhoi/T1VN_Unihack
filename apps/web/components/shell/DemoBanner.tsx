/** True when the site was built for the live demo (`NEXT_PUBLIC_HUISAFE_DEMO=true`, inlined at build time). */
export const DEMO_BUILD = process.env.NEXT_PUBLIC_HUISAFE_DEMO === 'true';
