import { tr } from '@/strings';
import { TabStack } from '@/ui/tab-stack';

export default function PlanTabLayout() {
  return <TabStack title={tr.plan.tab} />;
}
