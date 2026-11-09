import { SettingsView } from '@/components/settings/SettingsView';

export const metadata = { title: 'Cài đặt' };

/** S14: text size, backup of sealed bids, reminders. All choices stay in this browser. */
export default function Settings() {
  return <SettingsView />;
}
