import { router } from 'expo-router';

import { tr } from '@/strings';
import { HeaderButton } from '@/ui/components';
import { TabStack } from '@/ui/tab-stack';

export default function TimerTabLayout() {
  return (
    <TabStack
      title={tr.tabs.timer}
      // Geçmiş sits in the header: always one tap away, out of the way of the core loop.
      headerRight={() => (
        <HeaderButton testID="open-history" icon="history" title={tr.timer.history} onPress={() => router.push('/gecmis')} />
      )}
    />
  );
}
