import { UbndView } from '@/components/ubnd/UbndView';

export const metadata = { title: 'Thông báo UBND' };

/** S15: the Article 14 notice, drafted from the fixed template. Personal details are typed and kept on this device only. */
export default function Ubnd() {
  return <UbndView />;
}
