import { tr } from '@/strings';
import { TabStack } from '@/ui/tab-stack';

export default function GroupsTabLayout() {
  return <TabStack title={tr.tabs.groups} />;
}
