/**
 * Earlier versions of the legal texts. `archive` lists them; the generator writes the version
 * before the group module (the device texts of src/strings.ts, legalDocs) into
 * gizlilik/arsiv/<date>/ and refuses to build if those texts no longer carry that date
 * (LEGAL_UPDATED): an archived version must not change after the fact. When the device texts are
 * edited, freeze the old pages first (keep the published files) and add the new date here.
 */

import { LEGAL_PAGES_UPDATED, type LegalPage } from './_shared';

/** The device-only version (Etüt 0.4.x, no server), published at the site root until groups. */
export const DEVICE_ARCHIVE = { dir: 'gizlilik/arsiv/2026-10-18', updated: '18 Ekim 2026' } as const;

export const page: LegalPage = {
  slug: 'gizlilik/arsiv',
  title: 'Eski sürümler',
  updated: LEGAL_PAGES_UPDATED,
  intro: [
    'Aydınlatma metni, gizlilik politikası ve kullanım şartlarının önceki sürümleri burada durur. Geçerli sürümler: [Aydınlatma metni](aydinlatma) · [Gizlilik politikası](gizlilik) · [Kullanım şartları](kullanim).',
  ],
  sections: [
    {
      heading: `${DEVICE_ARCHIVE.updated}: grup özelliğinden önceki sürüm`,
      blocks: [
        'Etüt’ün yalnız telefonda çalıştığı, sunucusu ve grup özelliği olmayan sürümün metinleri. Grup özelliğiyle birlikte yerlerini bugünkü metinler aldı.',
        {
          list: [
            `[Aydınlatma metni](${DEVICE_ARCHIVE.dir}/aydinlatma)`,
            `[Gizlilik politikası](${DEVICE_ARCHIVE.dir}/gizlilik)`,
            `[Kullanım şartları](${DEVICE_ARCHIVE.dir}/kullanim)`,
          ],
        },
      ],
    },
  ],
};
