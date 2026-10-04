#!/usr/bin/env bash
# Daily integrity record of the access logs (hukuk/kvkk/09 "5651 trafik kaydı": günlük özet
# değeri ayrı bir dosyada). Every rotated log file gets its SHA-256 appended once to a separate,
# append-only ledger; the ledger itself is chained (each line includes the previous line's hash),
# so a later change to an old log or to the ledger shows up in `log-hash.sh --verify`.
set -euo pipefail
LOGDIR=/var/log/caddy
LEDGER=/var/lib/etut/log-hashes.txt
install -d -m 750 /var/lib/etut
touch "$LEDGER"
chmod 640 "$LEDGER"

if [ "${1:-}" = "--verify" ]; then
  prev=GENESIS
  status=0
  while IFS=' ' read -r chain file filehash at; do
    expected=$(printf '%s %s %s %s' "$prev" "$file" "$filehash" "$at" | sha256sum | cut -d' ' -f1)
    [ "$expected" = "$chain" ] || { echo "LEDGER BROKEN at $file"; status=1; }
    if [ -f "$LOGDIR/$file" ] && [ "$(sha256sum "$LOGDIR/$file" | cut -d' ' -f1)" != "$filehash" ]; then
      echo "CHANGED: $file"; status=1
    fi
    prev=$chain
  done < "$LEDGER"
  [ $status -eq 0 ] && echo "ledger and logs intact"
  exit $status
fi

prev=$(tail -n 1 "$LEDGER" | cut -d' ' -f1)
[ -n "$prev" ] || prev=GENESIS
# Rotated files only (the live file is still being written).
for path in "$LOGDIR"/*-access-*.log*; do
  [ -f "$path" ] || continue
  file=$(basename "$path")
  grep -q " $file " "$LEDGER" && continue
  filehash=$(sha256sum "$path" | cut -d' ' -f1)
  at=$(date -u +%FT%TZ)
  chain=$(printf '%s %s %s %s' "$prev" "$file" "$filehash" "$at" | sha256sum | cut -d' ' -f1)
  echo "$chain $file $filehash $at" >> "$LEDGER"
  prev=$chain
done
