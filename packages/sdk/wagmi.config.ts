import { defineConfig } from '@wagmi/cli';
import { foundry } from '@wagmi/cli/plugins';

/** ABI generation from `contracts/out` (docs/05 section 7.2). Run `pnpm --filter sdk generate`. */
export default defineConfig({
  out: 'src/generated.ts',
  plugins: [
    foundry({
      project: '../../contracts',
      include: [
        'HuiFactory.sol/**',
        'HuiCircle.sol/**',
        'MockUSDC.sol/**',
        'IReputationRegistry.sol/**',
        'IUSDCPermit.sol/**',
        'ERC2771Forwarder.sol/**',
      ],
    }),
  ],
});
