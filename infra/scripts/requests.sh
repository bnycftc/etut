#!/usr/bin/env bash
# KVKK applications made in the app (K-31, K-38; app.dsr_requests). Run by the operator in an SSH
# session on the server; nothing here is sent anywhere. The answer is written once and can never
# be changed (database trigger), so `answer` shows everything and asks before writing.
#
#   requests.sh list            unanswered applications, oldest deadline first
#   requests.sh list all        every application, with the answer state and when it was opened
#   requests.sh show <no>       one application in full (number as shown in the app: ABCD-EFGH)
#   requests.sh answer <no> <accepted|partial|rejected> <file>
#                               writes the answer text from <file> (kvkk/07 C4 wording)
#   requests.sh due [days]      day-30 warning: unanswered applications due within <days>
#                               (default 5) or overdue; exits 1 when there is any
set -euo pipefail

cd /opt/etut/supabase

psql_db() {
  docker compose exec -T db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -X -q "$@"
}

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

show_request() {
  psql_db -P pager=off -P expanded=on -v ref="$1" <<'SQL'
select left(r.ref, 4) || '-' || right(r.ref, 4) as no, r.kind as tur, r.applicant as basvuran,
       r.created_at at time zone 'Europe/Istanbul' as tarih,
       r.due_at at time zone 'Europe/Istanbul' as son_gun,
       r.user_id as hesap, r.body as aciklama,
       r.answered_at at time zone 'Europe/Istanbul' as cevap_tarihi, r.answer_result as sonuc,
       r.answer_text as cevap, r.seen_at at time zone 'Europe/Istanbul' as ilk_acilis
  from app.dsr_requests r
 where r.ref = app.normalize_code(:'ref');
SQL
}

cmd=${1:-}
case "$cmd" in
  list)
    if [ "${2:-}" = "all" ]; then
      filter="true"
    else
      filter="r.answered_at is null"
    fi
    psql_db -P pager=off <<SQL
select left(r.ref, 4) || '-' || right(r.ref, 4) as no,
       r.kind as tur,
       r.applicant as basvuran,
       to_char(r.created_at at time zone 'Europe/Istanbul', 'YYYY-MM-DD HH24:MI') as tarih,
       to_char(r.due_at at time zone 'Europe/Istanbul', 'YYYY-MM-DD') as son_gun,
       case when r.answered_at is not null then 'cevaplandi'
            when r.due_at < now() then 'SURE GECTI'
            else ceil(extract(epoch from (r.due_at - now())) / 86400)::int || ' gun' end as durum,
       r.answer_result as sonuc,
       to_char(r.seen_at at time zone 'Europe/Istanbul', 'YYYY-MM-DD HH24:MI') as acildi,
       (r.user_id is null) as hesap_silindi
  from app.dsr_requests r
 where ${filter}
 order by r.answered_at is not null, r.due_at;
SQL
    ;;

  show)
    [ -n "${2:-}" ] || usage
    show_request "$2"
    ;;

  answer)
    [ $# -eq 4 ] || usage
    ref=$2
    result=$3
    file=$4
    case "$result" in accepted | partial | rejected) ;; *) usage ;; esac
    [ -s "$file" ] || { echo "answer file '$file' is missing or empty" >&2; exit 2; }
    body=$(cat "$file")
    show_request "$ref"
    echo "----- answer ($result) -----"
    printf '%s\n' "$body"
    echo "----------------------------"
    echo "The answer can never be changed once written. Type 'evet' to write it:"
    read -r confirm
    [ "$confirm" = "evet" ] || { echo "not written"; exit 1; }
    psql_db -v ref="$ref" -v result="$result" -v body="$body" <<'SQL'
select app.answer_request(:'ref', :'result', :'body');
SQL
    echo "written; the applicant sees it under Başvurularım"
    ;;

  due)
    days=${2:-5}
    case "$days" in '' | *[!0-9]*) usage ;; esac
    out=$(psql_db -tA -F ' ' -v days="$days" <<'SQL'
select left(r.ref, 4) || '-' || right(r.ref, 4),
       to_char(r.due_at at time zone 'Europe/Istanbul', 'YYYY-MM-DD'),
       case when r.due_at < now() then 'SURE GECTI' else 'yaklasiyor' end
  from app.dsr_requests r
 where r.answered_at is null and r.due_at < now() + make_interval(days => :'days'::int)
 order by r.due_at;
SQL
)
    if [ -z "$out" ]; then
      echo "OK   no application due within ${days} days"
      exit 0
    fi
    echo "WARN applications to answer (KVKK m.13: 30 days):"
    printf '%s\n' "$out"
    exit 1
    ;;

  *)
    usage
    ;;
esac
