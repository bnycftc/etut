-- Etüt backend, step 2: nickname and group name filter (hukuk/03 K-26, K-27).
--
-- Why SQL and not an Edge Function with terlik.js:
--   * The check runs inside the same transaction as the RPC that stores the name, so no path can
--     store a name without passing it (an Edge Function would either be a second write path with
--     the service key or need pg_net, which is asynchronous).
--   * No extra service on the single VPS (the Deno edge runtime costs memory) and no npm code in
--     the trust path of the server.
--   * The rules are testable with pgTAP next to the RLS tests, and the word list is a table, so
--     moderation can add terms without a deploy.
--   Cost: terlik.js knows more Turkish suffixes and evasions. The list here is deliberately
--   conservative (whole-word matches for short roots, substring matches only for unambiguous
--   roots) to avoid false positives such as "sıkı", "sıkıntı" or "seksen".
--
-- Matching works on a normalised form: Turkish lower case, common digit/symbol substitutions,
-- Turkish letters folded to ASCII except dotless ı (so "sık" never becomes "sik"), repeated
-- letters collapsed.

create table app.banned_terms (
  -- Stored in normalised form (lower case ASCII, no repeated letters).
  term text primary key check (term ~ '^[a-z]+$'),
  -- 'word': matches a whole word, or a word start when `suffixes` is true.
  -- 'part': matches inside a word; terms of 6+ letters also across spaces ("o r o s p u").
  match text not null check (match in ('word', 'part')),
  suffixes boolean not null default false
);

-- Nicknames that would let someone impersonate the app or its staff (whole words).
create table app.reserved_names (
  term text primary key check (term ~ '^[a-z]+$')
);

insert into app.reserved_names (term) values
  ('admin'), ('etut'), ('moderator'), ('yonetici'), ('destek'), ('resmi'), ('sistem');

insert into app.banned_terms (term, match, suffixes) values
  ('orospu', 'part', false),
  ('orosbu', 'part', false),
  ('siktir', 'part', false),
  ('sikis', 'part', false),
  ('sikeyim', 'part', false),
  ('sikerim', 'part', false),
  ('yarak', 'part', false),
  ('amcik', 'part', false),
  ('aminako', 'part', false),
  ('pezevenk', 'part', false),
  ('gavat', 'part', false),
  ('kahpe', 'part', false),
  ('yavsak', 'part', false),
  ('serefsiz', 'part', false),
  ('kaltak', 'part', false),
  ('fahise', 'part', false),
  ('gotveren', 'part', false),
  ('pickurusu', 'part', false),
  ('ibne', 'part', false),
  ('porno', 'part', false),
  ('fuck', 'part', false),
  ('bitch', 'part', false),
  ('pusy', 'part', false),
  ('amina', 'word', true),
  ('pust', 'word', true),
  ('sikik', 'word', true),
  ('sik', 'word', false),
  ('sikim', 'word', false),
  ('amk', 'word', false),
  ('aq', 'word', false),
  ('mk', 'word', false),
  ('oc', 'word', false),
  ('pic', 'word', false),
  ('picler', 'word', false),
  ('got', 'word', false),
  ('meme', 'word', false),
  ('seks', 'word', false),
  ('sex', 'word', true),
  ('nude', 'word', true),
  ('dick', 'word', true);

create or replace function app.normalize_name(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(
           translate(
             lower(translate(p_text, 'İI', 'iı')),
             -- digits/symbols used as letters, then Turkish letters folded to ASCII (ı kept)
             '013457@$!çğöşüâîû',
             'oieastasicgosuaiu'),
           '([a-zı])\1+', '\1', 'g')
$$;

-- Canonical stored form: trimmed, inner whitespace collapsed.
create or replace function app.clean_name(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'))
$$;

-- Returns NULL when the name is acceptable, otherwise an error code the app translates:
--   'name_length' | 'name_chars' | 'name_personal' | 'name_banned'
-- p_kind: 'nickname' (3–20 characters) or 'group' (3–24 characters).
create or replace function app.check_name(p_text text, p_kind text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_text text := app.clean_name(p_text);
  v_max integer := case when p_kind = 'group' then 24 else 20 end;
  v_norm text;
  v_joined text;
  v_words text[];
  v_word text;
  v_term record;
begin
  if char_length(v_text) < 3 or char_length(v_text) > v_max then
    return 'name_length';
  end if;
  -- Letters (Turkish included), digits, space and . _ - only: no emoji, no symbols (K-26).
  if v_text !~ '^[A-Za-z0-9çğıöşüâîûÇĞİÖŞÜÂÎÛ ._-]+$' then
    return 'name_chars';
  end if;
  -- Personal data patterns (K-26, K-27): phone numbers (7+ digits in total), web addresses and
  -- social media names. '@' never passes the character check above.
  if char_length(regexp_replace(v_text, '[^0-9]', '', 'g')) >= 7 then
    return 'name_personal';
  end if;
  if v_text !~ '[A-Za-zçğıöşüâîûÇĞİÖŞÜÂÎÛ]' then
    return 'name_chars';
  end if;
  v_norm := app.normalize_name(v_text);
  v_joined := regexp_replace(v_norm, '[^a-zı]', '', 'g');
  if lower(v_text) ~ '(www|https?)' or v_norm ~ '\.(com|net|org|tr|io|me|app|gg|ly|co)\M'
     or v_joined ~ '(instagram|insta|tiktok|snapchat|discord|whatsap|telegram|twiter|youtube|facebok|onlyfans)' then
    return 'name_personal';
  end if;
  -- A birth year in a nickname reveals the age (K-20); allowed in group names ("YKS 2027").
  if p_kind = 'nickname' and v_text ~ '(19[4-9][0-9]|20[0-2][0-9])' then
    return 'name_personal';
  end if;

  v_words := array_remove(regexp_split_to_array(v_norm, '[^a-zı]+'), '');
  if p_kind = 'nickname' and exists (
    select 1 from app.reserved_names r where r.term = any (v_words)
  ) then
    return 'name_banned';
  end if;

  for v_term in select term, match, suffixes from app.banned_terms loop
    foreach v_word in array v_words loop
      if (v_term.match = 'part' and position(v_term.term in v_word) > 0)
         or (v_term.match = 'word' and v_term.suffixes and left(v_word, char_length(v_term.term)) = v_term.term)
         or (v_term.match = 'word' and v_word = v_term.term) then
        return 'name_banned';
      end if;
    end loop;
    if v_term.match = 'part' and char_length(v_term.term) >= 6
       and position(v_term.term in v_joined) > 0 then
      return 'name_banned';
    end if;
  end loop;
  return null;
end
$$;
