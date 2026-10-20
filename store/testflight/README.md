# TestFlight metinleri (kapalı beta, GROUPS_PHASE 'beta18')

Bu metinler App Store Connect'e elle girilir; hiçbir iş akışı yazmaz.

| Dosya | App Store Connect'te yeri |
|---|---|
| `tr/what_to_test.txt` | TestFlight > derleme > Test Information > What to Test (tr) |
| `tr/beta_description.txt` | TestFlight > Test Information > Beta App Description |
| `beta-review-notes.txt` | TestFlight > Test Information > Beta App Review Information > Review Notes |

Beta App Review Information'da ayrıca: Sign-in required **kapalı** (grup hesabı anonim; demo grup
için giriş gerekmez), iletişim bilgileri elle. Feedback Email ve Marketing/Privacy Policy URL de
elle girilir.

`[DEMO KODU]` yerine sunucuda `sudo bash infra/scripts/demo-seed.sh` çıktısındaki kod yazılır;
kod bu depoya (herkese açık) asla yazılmaz. Göndermeden hemen önce betiği yeniden çalıştır: demo
gruptaki gerçek üyeleri çıkarır ve demo sürelerini bugüne taşır.

Herkese açık sürümün (App Store) inceleme notu `store/app-store/groups/review-notes.txt`'tedir;
asc-metadata.yml `[DEMO KODU]`'nu DEMO_INVITE_CODE gizli değişkeninden doldurur ve faz 'beta18'
iken inceleme notunu hiç yazmaz.
