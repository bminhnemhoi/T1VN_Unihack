/**
 * `HuiCircle` hands its view functions to `HuiCircleLens` by delegatecall (docs/05 section 2.1), so the compiled
 * `HuiCircle` ABI lacks `roundInfo`, `memberInfo`, `deadline`, `params`... They are in `IHuiCircle`. Callers that read
 * or write a circle use this merged ABI: the circle's own functions, events and errors plus the lens-served views.
 */
import { huiCircleAbi, iHuiCircleAbi } from './generated';

const LENS_VIEWS = [
  'commitOf',
  'coverageIndexBps',
  'deadline',
  'dueOf',
  'exposure',
  'lateFeeOf',
  'maxBid',
  'maxExposure',
  'memberInfo',
  'members',
  'params',
  'phase',
  'roundInfo',
  'roundStart',
  'shortfallOf',
] as const;
type LensViewName = (typeof LENS_VIEWS)[number];
type LensView = Extract<(typeof iHuiCircleAbi)[number], { name: LensViewName }>;

const names: ReadonlySet<string> = new Set(LENS_VIEWS);

export const huiCircleFullAbi = [
  ...huiCircleAbi,
  ...iHuiCircleAbi.filter((item) => 'name' in item && names.has(item.name)),
] as unknown as readonly [...typeof huiCircleAbi, ...LensView[]];
