#!/usr/bin/env bash
# Moderation reports for the operator (K-28: review within 24 h, K-29: emergency procedure).
# Only in an interactive SSH session: nicknames and group names are printed to this terminal
# and nowhere else (not to a pipe, a file, the journal or the alert channel).
#
#   sudo /opt/etut/bin/reports.sh                      open reports, danger first
#   sudo /opt/etut/bin/reports.sh close <id> <karar>   close one after review (app.close_report)
#
# <karar>: no_action | name_changed | member_removed | account_removed | reported_to_authorities
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)"; exit 1; }

# An SSH session: sudo drops SSH_CONNECTION, so also look for sshd among the parent processes.
in_ssh() {
  [ -n "${SSH_CONNECTION:-}" ] && return 0
  local pid=$PPID comm
  while [ "${pid:-0}" -gt 1 ]; do
    comm=$(ps -o comm= -p "$pid" 2>/dev/null) || return 1
    case "$comm" in sshd*) return 0 ;; esac
    pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
  done
  return 1
}
in_ssh || { echo "Only inside an SSH session on the server."; exit 1; }
[ -t 0 ] && [ -t 1 ] || { echo "Only on an interactive terminal (no pipe, no redirect)."; exit 1; }

cd /opt/etut/supabase
db() { docker compose exec -T db psql -X -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -P pager=off "$@"; }

list() {
  db -q <<'SQL'
select r.id,
       r.reason as tur,
       to_char(r.created_at at time zone 'Europe/Istanbul', 'YYYY-MM-DD HH24:MI') as acildi,
       round(extract(epoch from now() - r.created_at) / 3600.0, 1) as saat,
       coalesce(t.nickname, '(hesap silinmiş)') as hedef,
       coalesce(g.name, '-') as grup
  from app.reports r
  left join app.profiles t on t.user_id = r.target_user_id
  left join app.groups g on g.id = r.group_id
 where r.status = 'open'
 order by (r.reason = 'danger') desc, r.created_at;
SQL
  echo "Kapat: sudo /opt/etut/bin/reports.sh close <id> <karar>"
}

k28_checklist() {
  cat <<'EOF'
Kapatmadan önce (K-28):
  [ ] Raporu inceledim (hedef, grup, tür); 24 saat hedefi içinde.
  [ ] Kararı önce uyguladım (Studio / psql): takma ad ya da grup adı sıfırlandı (name_changed),
      üye gruptan çıkarıldı (member_removed), hesap silindi (account_removed), ya da gerek yok
      (no_action).
  [ ] Defter (D5, çevrim dışı): rapor zamanı, tür, karar, karar zamanı. Takma ad yazma.
EOF
}

k29_checklist() {
  cat <<'EOF'
ACİL DURUM (K-29) — danger raporu ya da reported_to_authorities:
  [ ] Hayati tehlike, intihar riski ya da yakın tehdit: hemen 112.
  [ ] İstismar ya da suç şüphesi: 155 Polis İmdat (kırsalda 156 Jandarma) ya da Cumhuriyet
      Başsavcılığı; yazılı kayıt için EGM e-İhbar (e-Devlet). Bekletmeden bildir.
  [ ] Kolluk veri isterse yalnız yazılı talebe ve yalnız istenen kadar ver; rapor kaydını silme
      (kapanıştan sonra 2 yıl saklanır).
  [ ] Bildirim yapıldıysa karar reported_to_authorities.
  [ ] Defter (D5, çevrim dışı): saat, kime bildirildi (112 / 155 / savcılık / EGM e-İhbar),
      ihbar ya da başvuru numarası, alınan önlem. Takma ad ve grup adı deftere değil, kolluğa.
EOF
}

close_one() {
  local id=$1 karar=$2 reason answer
  [[ "$id" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]] || { echo "Geçersiz id"; exit 2; }
  case "$karar" in
    no_action | name_changed | member_removed | account_removed | reported_to_authorities) ;;
    *) echo "Geçersiz karar: no_action | name_changed | member_removed | account_removed | reported_to_authorities"; exit 2 ;;
  esac
  reason=$(db -tA -v id="$id" <<'SQL'
select reason from app.reports where id = :'id'::uuid and status = 'open';
SQL
)
  [ -n "$reason" ] || { echo "Açık rapor yok: $id"; exit 1; }
  echo "Rapor $id, tür: $reason, karar: $karar"
  k28_checklist
  if [ "$reason" = danger ] || [ "$karar" = reported_to_authorities ]; then
    k29_checklist
    [ "$reason" = danger ] && [ "$karar" != reported_to_authorities ] &&
      echo "Not: danger raporu reported_to_authorities dışında bir kararla kapanıyor; nedenini deftere yaz."
  fi
  read -r -p "Adımlar tamam, kapatılsın mı? (evet/hayır) " answer
  [ "$answer" = evet ] || { echo "Kapatılmadı."; exit 1; }
  db -q -v id="$id" -v karar="$karar" <<'SQL'
select app.close_report(:'id'::uuid, :'karar');
SQL
  echo "Kapatıldı ($(date -u +%FT%TZ)). Açık danger / 12 s / 24 s:"
  db -tA -F ' ' -c 'select * from app.report_alert_counts()'
}

case "${1:-list}" in
  list) list ;;
  close)
    [ $# -eq 3 ] || { echo "Usage: $0 close <id> <karar>"; exit 2; }
    close_one "$2" "$3" ;;
  *) echo "Usage: $0 [list | close <id> <karar>]"; exit 2 ;;
esac
