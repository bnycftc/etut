#!/usr/bin/env bash
# Creates the demo group for App Review (and the TestFlight Beta App Review), or brings it back to
# its seeded state, and prints its invite code. Run on the server after 04-migrate.sh:
#
#   sudo bash infra/scripts/demo-seed.sh              # same code as before (new group: new code)
#   sudo bash infra/scripts/demo-seed.sh --new-code   # the old code stops working at once
#
# What it does (app.demo_seed(), supabase/migrations/20261020120300_etut_demo.sql): five fake
# accounts named "Demo …" (adults, never sign in), one of them the founder, made-up study times for
# the last 7 days, the group "Etüt Demo" with a code that never expires. Real members are taken
# out, so the reviewer joins a clean group. A join with the code needs no founder; only 18+
# accounts can join, and a real member is taken out again after 7 days.
#
# Run it again right before every App Review or Beta App Review submission (the study times are
# relative to today, and it keeps the fake accounts from the 6-month inactivity purge).
#
# The code is printed here only. It goes into the review notes through the GitHub secret
# DEMO_INVITE_CODE (asc-metadata.yml fills [DEMO KODU] from it) and by hand into the Beta App
# Review information (store/testflight/). Never commit it: the repository is public, and the code
# lets anyone into the demo group. If it leaks, run this with --new-code and update the secret.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }

new_code=false
case "${1:-}" in
  "") ;;
  --new-code) new_code=true ;;
  *) echo "usage: $0 [--new-code]"; exit 2 ;;
esac

cd /opt/etut/supabase
psql_db() { docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }

code=$(psql_db -tA -c "select app.demo_seed(${new_code})")
[[ "$code" =~ ^[A-HJ-NP-Z2-9]{8}$ ]] || { echo "unexpected result from app.demo_seed(): $code"; exit 1; }

psql_db -tA -F ' ' -c "select 'members', g.member_count, 'invite_expires_at', g.invite_expires_at
                         from app.groups g where g.is_demo"
echo "demo invite code: ${code:0:4}-${code:4:4}"
echo "next: gh secret set DEMO_INVITE_CODE --repo bnycftc/etut   (paste the 8 characters without the dash)"
