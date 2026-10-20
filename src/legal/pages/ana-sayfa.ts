/** Home page of the legal site (index.html), group version. */

import { C, LEGAL_PAGES_UPDATED, type LegalPage } from './_shared';

export const page: LegalPage = {
  slug: 'index',
  title: 'Etüt',
  updated: LEGAL_PAGES_UPDATED,
  nav: { label: 'Etüt', order: 0 },
  intro: [
    'Etüt, sınava hazırlanan öğrenciler için bir çalışma sayacı ve deneme takip uygulamasıdır. Sayaç, denemeler ve netler telefonunda kalır. İstersen davet koduyla kurulan, en fazla 30 kişilik çalışma gruplarına katılabilirsin; o zaman takma adın ve çalışma sürelerin Türkiye’deki sunucumuzda tutulur. Reklam, analitik ve izleme yoktur.',
    {
      list: [
        '[Aydınlatma metni](aydinlatma)',
        '[Gizlilik politikası](gizlilik)',
        '[Kullanım şartları ve topluluk kuralları](kullanim)',
        '[Velilere](veli)',
        '[Çocuk güvenliği ve yaş politikası](cocuk-guvenligi)',
        '[Saklama ve imha politikası](saklama)',
        '[Hesabını silme](hesap-sil)',
        '[İletişim](iletisim)',
        '[Eski sürümler](gizlilik/arsiv)',
      ],
    },
    `Veri sorumlusu: ${C.name} · İletişim: ${C.contact}`,
  ],
  sections: [],
};
