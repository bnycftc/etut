# Official Supabase Postgres image plus pgBackRest (WAL archive + encrypted backups over SFTP).
# The tag must match the db image of the pinned self-hosted compose (03-supabase.sh checks it).
ARG SUPABASE_POSTGRES_TAG
FROM supabase/postgres:${SUPABASE_POSTGRES_TAG}

USER root
# pgBackRest >= 2.46 is needed for the SFTP repository type. The PGDG apt repository has a current
# pgBackRest for both Ubuntu 22.04 and 24.04. [KONTROL at first build: the base image is
# Ubuntu-based and has apt; 03-supabase.sh prints /etc/os-release and `pgbackrest version`.]
RUN set -eux; \
    . /etc/os-release; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg openssh-client; \
    install -d /usr/share/postgresql-common/pgdg; \
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc; \
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends pgbackrest; \
    rm -rf /var/lib/apt/lists/*; \
    install -d -o postgres -g postgres -m 750 /var/spool/pgbackrest /var/log/pgbackrest /tmp/pgbackrest; \
    pgbackrest version
# The base image's entrypoint starts as root and drops to `postgres` itself; the default user
# is left as root like in the base image. [KONTROL: `docker inspect supabase/postgres:<tag>
# --format '{{.Config.User}}'` must print an empty string; if it prints a user, add `USER <it>`.]
