import { LabView } from '@/components/lab/LabView';
import { loadLab } from '@/lib/lab-data';

export const metadata = { title: 'Phòng mô phỏng' };

/** S16: charts from `sim/outputs`, read at build time. Says what is assumed, or that nothing has been run yet. */
export default function Lab() {
  return <LabView data={loadLab()} />;
}
