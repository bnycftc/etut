import { tr } from '@/strings';
import { TabStack } from '@/ui/tab-stack';

export default function SettingsTabLayout() {
  return <TabStack title={tr.tabs.settings} />;
}
