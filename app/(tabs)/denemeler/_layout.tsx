import { tr } from '@/strings';
import { TabStack } from '@/ui/tab-stack';

export default function ExamsTabLayout() {
  return <TabStack title={tr.tabs.exams} />;
}
