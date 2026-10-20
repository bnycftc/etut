/**
 * "İletişim" (hukuk/03 K-31, K-42): who runs the service and how to reach them.
 *
 * Postal address: deliberately absent. Whether one is published, and which (PK or virtual
 * office instead of a home address), is bny's open K-42 decision; until it is made, contact is by
 * e-mail only (bny, 18 Oct 2026). When it is decided, add it here and to `C` in _shared.ts.
 */

import { C, LEGAL_PAGES_UPDATED, type LegalPage } from './_shared';

export const page: LegalPage = {
  slug: 'iletisim',
  title: 'İletişim',
  updated: LEGAL_PAGES_UPDATED,
  nav: { label: 'İletişim', order: 7 },
  sections: [
    {
      heading: 'Etüt’ü kim işletiyor?',
      blocks: [
        `Etüt’ü ${C.name} tek başına geliştiriyor ve işletiyor. Şirket değil, gerçek kişidir; kişisel veriler bakımından veri sorumlusudur.`,
        `E-posta: ${C.contact}`,
        'Uygulamada: Hakkında → İletişim ya da Ayarlar → Geri bildirim gönder (ikisi de e-posta uygulamanı bu adresle açar).',
      ],
    },
    {
      heading: 'Ne için yazabilirsin?',
      blocks: [
        {
          list: [
            'Soru, sorun ve geri bildirim.',
            'KVKK başvurusu: hakların ve başvuru yolu [Aydınlatma metni](aydinlatma) sayfasında yazar. En geç 30 gün içinde ücretsiz ve yazılı cevap veririz.',
            'Şikâyet: bir kullanıcıyı ya da grubu uygulamadaki “Bildir” ile de bildirebilirsin; hedefimiz bildirimleri 24 saat içinde incelemek. Bir karara itirazını 14 gün içinde e-postayla yapabilirsin.',
            'Çocuk güvenliği: irtibat kişisi aynı kişidir; bu tür yazılara öncelik veririz. Tedbirler: [Çocuk güvenliği ve yaş politikası](cocuk-guvenligi).',
            'Veli başvuruları: [Velilere](veli).',
            'Güvenlik açığı bildirimi.',
            'Yetkili makamların talepleri.',
          ],
        },
      ],
    },
    {
      heading: 'Acil durum',
      blocks: [
        'Biri kendine ya da başkasına zarar vereceğini söylüyorsa ya da bir çocuğun güvenliği tehlikedeyse bize yazmadan önce 112’yi ara.',
      ],
    },
    {
      heading: 'Diğer metinler',
      blocks: [
        '[Gizlilik politikası](gizlilik) · [Kullanım şartları ve topluluk kuralları](kullanim) · [Saklama ve imha politikası](saklama)',
      ],
    },
  ],
};
