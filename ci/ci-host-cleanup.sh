#!/usr/bin/env bash
#
# Weekly disk cleanup for the CI host (gatekeeper: Jenkins, the lingonberg.se
# registry on :5505, and the staging stack). Run as root by
# ci-host-cleanup.timer; see STAGING.md, "Behind an existing reverse proxy".
#
# What fills the disk, measured 2026-10-13 (115 GB root, 25 GB free):
#   44 GB  Docker build cache — every Jenkins build adds to it, nothing removes it
#    7 GB  Jenkins workspaces, 3 GB of them for jobs that no longer exist
#    3.5 GB registry: 35 <sha12> tags per image, never deleted
#    2.8 GB systemd journal
#
# Every step is skipped while a Jenkins build is running: pruning the cache or
# garbage-collecting the registry under a build breaks that build.
#
# Registry: keeps the newest $KEEP_TAGS <sha12>(-staging) tags per repository plus
# every non-sha tag (latest, staging) and anything sharing a digest with one —
# deleting a manifest deletes EVERY tag on that digest, so `latest` would go with
# its sha tag otherwise. Production pulls `latest` by default; a pinned
# IMAGE_TAG older than the newest $KEEP_TAGS would be lost.
#
# Env overrides: KEEP_BUILD_CACHE (10GB), IMAGE_MAX_AGE (168h), WORKSPACE_MAX_DAYS
# (14), JOURNAL_MAX (1G), KEEP_TAGS (10), REGISTRY_URL (http://localhost:5505),
# REGISTRY_CONFIG (/etc/docker/registry/config.yml), DRY_RUN (unset).

set -euo pipefail

KEEP_BUILD_CACHE="${KEEP_BUILD_CACHE:-10GB}"
IMAGE_MAX_AGE="${IMAGE_MAX_AGE:-168h}"
WORKSPACE_MAX_DAYS="${WORKSPACE_MAX_DAYS:-14}"
JOURNAL_MAX="${JOURNAL_MAX:-1G}"
KEEP_TAGS="${KEEP_TAGS:-10}"
REGISTRY_URL="${REGISTRY_URL:-http://localhost:5505}"
REGISTRY_CONFIG="${REGISTRY_CONFIG:-/etc/docker/registry/config.yml}"
WORKSPACES=/var/lib/jenkins/workspace

log() { printf '%s %s\n' "$(date -Is)" "$*"; }
run() { if [ -n "${DRY_RUN:-}" ]; then log "dry-run: $*"; else "$@"; fi; }

if pgrep -u jenkins -f 'docker (compose |buildx )?(build|push)|MSBuild.dll|vite build|npm (ci|run build)' >/dev/null; then
  log "a Jenkins build is running; skipping this run"
  exit 0
fi

log "disk before: $(df -h --output=avail / | tail -1) free"

log "docker: build cache down to $KEEP_BUILD_CACHE"
run docker builder prune -f --keep-storage "$KEEP_BUILD_CACHE"

# `until` compares the image's CREATION date, not its pull date, so base images
# (node:24, dotnet/sdk) go too and the next build pulls them again. Acceptable weekly.
log "docker: unused images older than $IMAGE_MAX_AGE (they are in the registry)"
run docker image prune -af --filter "until=$IMAGE_MAX_AGE"

log "jenkins: workspaces with nothing modified in $WORKSPACE_MAX_DAYS days"
if [ -d "$WORKSPACES" ]; then
  for d in "$WORKSPACES"/*/; do
    d="${d%/}"
    if [ -z "$(find "$d" -mtime "-$WORKSPACE_MAX_DAYS" -print -quit 2>/dev/null)" ]; then
      log "  removing $d ($(du -sh "$d" 2>/dev/null | cut -f1))"
      run rm -rf -- "$d"
    fi
  done
fi

log "journal: down to $JOURNAL_MAX"
run journalctl --vacuum-size="$JOURNAL_MAX" --quiet

log "registry: keeping the newest $KEEP_TAGS sha tags per repository"
DRY_RUN="${DRY_RUN:-}" python3 - "$REGISTRY_URL" "$KEEP_TAGS" <<'PY'
import json, re, sys, urllib.request

base, keep = sys.argv[1], int(sys.argv[2])
dry = bool(__import__("os").environ.get("DRY_RUN"))
ACCEPT = "application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json"
SHA_TAG = re.compile(r"^[0-9a-f]{12}(-staging)?$")

def req(path, method="GET"):
    r = urllib.request.Request(base + path, method=method, headers={"Accept": ACCEPT})
    return urllib.request.urlopen(r, timeout=30)

repos = json.load(req("/v2/_catalog?n=1000"))["repositories"] or []
for repo in repos:
    tags = json.load(req(f"/v2/{repo}/tags/list")).get("tags") or []
    info = {}  # tag -> (digest, created)
    for tag in tags:
        with req(f"/v2/{repo}/manifests/{tag}") as r:
            digest = r.headers["Docker-Content-Digest"]
            manifest = json.load(r)
        # No readable date (e.g. a multi-arch index) sorts as NEWEST, so it is kept.
        created = "9999"
        config = manifest.get("config", {}).get("digest")
        if config:
            created = json.load(req(f"/v2/{repo}/blobs/{config}")).get("created") or created
        info[tag] = (digest, created)

    sha_tags = sorted((t for t in tags if SHA_TAG.match(t)), key=lambda t: info[t][1], reverse=True)
    # Newest per flavour (production vs -staging), so staging builds cannot crowd out production.
    kept = set()
    for flavour in (False, True):
        kept |= set([t for t in sha_tags if t.endswith("-staging") == flavour][:keep])
    kept |= {t for t in tags if not SHA_TAG.match(t)}
    protected = {info[t][0] for t in kept}

    doomed = {info[t][0] for t in tags if t not in kept} - protected
    print(f"  {repo}: {len(tags)} tags, deleting {len(doomed)} manifest(s)", flush=True)
    for digest in sorted(doomed):
        if dry:
            print(f"    dry-run: delete {repo}@{digest}")
        else:
            req(f"/v2/{repo}/manifests/{digest}", method="DELETE").close()
PY

log "registry: garbage-collect (registry stopped meanwhile)"
if [ -z "${DRY_RUN:-}" ]; then
  systemctl stop docker-registry
  trap 'systemctl start docker-registry' EXIT
  runuser -u docker-registry -- docker-registry garbage-collect --delete-untagged "$REGISTRY_CONFIG" | tail -1
  systemctl start docker-registry
  trap - EXIT
fi

log "disk after: $(df -h --output=avail / | tail -1) free"
