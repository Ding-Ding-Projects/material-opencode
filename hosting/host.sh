#!/usr/bin/env sh
# Start the OpenCode web app in Docker and print the verified local-network URL.
#
#   hosting/host.sh                 run on this computer
#   hosting/host.sh --ssh user@host run on a Docker host over SSH (copies compose.yaml and .env there)
#   hosting/host.sh --build         build the image from this checkout instead of pulling it
#   hosting/host.sh --down          stop and remove the container (data volume is kept)
set -eu
here=$(cd "$(dirname "$0")" && pwd)
target=""
build=0
down=0
while [ $# -gt 0 ]; do
  case "$1" in
    --ssh) target="$2"; shift 2 ;;
    --build) build=1; shift ;;
    --down) down=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

[ -f "$here/.env" ] || bun "$here/setup.ts"
. "$here/.env"

if [ "$build" = 1 ]; then
  docker build -f "$here/Dockerfile" -t material-opencode:local "$here/.."
  sed -i.bak "s#^OPENCODE_IMAGE=.*#OPENCODE_IMAGE=material-opencode:local#" "$here/.env" && rm -f "$here/.env.bak"
  . "$here/.env"
fi

if [ -n "$target" ]; then
  remote="~/material-opencode-${OPENCODE_INSTANCE}"
  ssh "$target" "mkdir -p $remote"
  scp -q "$here/compose.yaml" "$here/.env" "$target:$remote/"
  if [ "$down" = 1 ]; then ssh "$target" "cd $remote && docker compose --env-file .env down"; exit 0; fi
  ssh "$target" "cd $remote && docker compose --env-file .env pull -q || true; docker compose --env-file .env up -d"
  host=$(ssh "$target" "hostname -I | cut -d' ' -f1")
else
  if [ "$down" = 1 ]; then docker compose --env-file "$here/.env" -f "$here/compose.yaml" down; exit 0; fi
  [ "$build" = 1 ] || docker compose --env-file "$here/.env" -f "$here/compose.yaml" pull -q || true
  docker compose --env-file "$here/.env" -f "$here/compose.yaml" up -d
  host=$( (hostname -I 2>/dev/null || ipconfig getifaddr en0 2>/dev/null || echo localhost) | cut -d' ' -f1)
fi

url="http://${host}:${OPENCODE_PORT}"
printf "Waiting for %s " "$url"
i=0
until curl -fsS -o /dev/null "$url/"; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then echo; echo "The app did not answer within 2 minutes. Logs: docker logs ${OPENCODE_INSTANCE}" >&2; exit 1; fi
  printf "."
  sleep 2
done
echo
echo "Ready: $url  (password is in hosting/.env)"
