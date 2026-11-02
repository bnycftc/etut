/**
 * Earlier versions of the legal texts. `archive` lists them; the generator writes the version
 * before the group module (the device texts of src/strings.ts, legalDocs) into
 * gizlilik/arsiv/<date>/ and refuses to build if those texts no longer carry that date
 * (LEGAL_UPDATED): an archived version must not change after the fact. When the device texts are
 * edited, freeze the old pages first (keep the published files) and add the new date here.
 * Frozen versions (src/legal/archive) are written from their own copy of the texts.
 */

import { FROZEN_2026_10_18 } from '../archive/2026-10-18';
import { LEGAL_PAGES_UPDATED, type LegalPage } from './_shared';

/** The device-only version (Etüt 0.4.x, no server), published at the site root until groups. */
export const DEVICE_ARCHIVE = { dir: 'gizlilik/arsiv/2026-10-31', updated: '31 Ekim 2026' } as const;

/** Older device-only versions, newest first; their texts no longer come from src/strings.ts. */
export const FROZEN_ARCHIVES = [FROZEN_2026_10_18] as const;

const links = (dir: string) => ({
  list: [`[Aydınlatma metni](${dir}/aydinlatma)`, `[Gizlilik politikası](${dir}/gizlilik)`, `[Kullanım şartları](${dir}/kullanim)`],
});

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
        links(DEVICE_ARCHIVE.dir),
      ],
    },
    ...FROZEN_ARCHIVES.map((a) => ({
      heading: `${a.updated}: önceki sürüm`,
      blocks: ['Yalnız telefonda çalışan sürümün daha eski metinleri.', links(a.dir)],
    })),
  ],
};
