import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Linking, Platform } from 'react-native';

import { contactEmail, feedbackMailUrl } from '@/domain/contact';
import { DATA_CONTROLLER, tr } from '@/strings';

/** "iOS 26.1": only the system and its version, nothing that identifies the phone or the student. */
function systemName(): string {
  const name = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web';
  return Platform.OS === 'web' ? name : `${name} ${String(Platform.Version)}`;
}

/**
 * The e-mail of Hakkında → İletişim and Ayarlar → Geri bildirim gönder: the same address and the
 * same subject (app and OS version only), no body. `email` is `null` while DATA_CONTROLLER.contact
 * is still the `[DOLDURULACAK]` placeholder (or not an e-mail address): the button stays disabled
 * ("Yakında"). No address is made up here; bny fills it in before release.
 */
export function useContactMail(): { email: string | null; failed: boolean; open: () => void } {
  const email = contactEmail(DATA_CONTROLLER.contact);
  const [failed, setFailed] = useState(false);
  const open = () => {
    if (email === null) return;
    setFailed(false);
    const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '–';
    const build = Application.nativeBuildVersion ?? '–';
    Linking.openURL(feedbackMailUrl(email, tr.contact.subject(version, build, systemName()))).catch(() =>
      setFailed(true),
    );
  };
  return { email, failed, open };
}
