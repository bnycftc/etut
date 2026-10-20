#!/usr/bin/env bash
# Deletes a group account by its account code (K-37; /hesap-sil "Yol 2"): the student no longer
# has the app and e-mailed the 12-character code shown under Gruplar → Grup hesabı. Run by the
# operator in an SSH session on the server (ssh <server>, then sudo this script); nothing here is
# sent anywhere. Shows the matching account, asks before deleting, and writes the deletion record
# (audit.deletion_records, method 'account_code', kept 3 years) through
# app.delete_by_account_code. The code itself is never logged.
#
#   delete-by-code.sh <code> [<YYYY-MM-DD>]
#                     <code>       as e-mailed (case, spaces and dashes do not matter)
#                     <YYYY-MM-DD> the day the e-mail arrived (default: today), the
#                                  "requested_at" of the deletion record
set -euo pipefail

cd /opt/etut/supabase

psql_db() {
  docker compose exec -T db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -X -q "$@"
}

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

if [ $# -lt 1 ] || [ $# -gt 2 ]; then usage; fi
code=$1
day=${2:-$(TZ=Europe/Istanbul date +%F)}
case "$day" in [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;; *) usage ;; esac

# The request time: noon of that Istanbul day, never later than now (the record requires
# requested_at <= deleted_at).
requested="least(('${day} 12:00'::timestamp at time zone 'Europe/Istanbul'), now())"

match=$(psql_db -tA -F ' | ' -v code="$code" <<'SQL'
select a.user_id,
       coalesce(p.nickname, '(profil yok: veli hesabı ya da profilsiz giriş)'),
       'kod ' || to_char(a.created_at at time zone 'Europe/Istanbul', 'YYYY-MM-DD'),
       'son kullanım ' || coalesce(to_char(p.last_active_at at time zone 'Europe/Istanbul', 'YYYY-MM-DD'), '-')
  from app.account_codes a
  left join app.profiles p on p.user_id = a.user_id
 where a.code_hash = app.account_code_hash(:'code');
SQL
)

if [ -z "$match" ]; then
  echo "No account has this code. Nothing was deleted."
  echo "Reply that the code did not match (kvkk/07 C3); do not delete by nickname or group name."
  logger -t etut-delete "delete-by-code: no match, nothing deleted" || true
  exit 1
fi

echo "Account:  $match"
echo "Request:  $day (e-mail)"
echo "Method:   account_code"
echo "Deletes the group account at once and for good (same as Grup hesabımı sil in the app)."
echo "Type 'evet' to delete:"
read -r confirm
[ "$confirm" = "evet" ] || { echo "not deleted"; exit 1; }

deleted=$(psql_db -tA -v code="$code" <<SQL
select app.delete_by_account_code(:'code', ${requested});
SQL
)

if [ -z "$deleted" ]; then
  echo "Nothing was deleted (the code no longer matches)."
  exit 1
fi
logger -t etut-delete "delete-by-code: account ${deleted} deleted, method account_code, requested ${day}" || true
echo "Deleted account ${deleted} (method account_code, requested ${day})."
echo "Deletion record written (audit.deletion_records, 3 years). Answer the e-mail."
