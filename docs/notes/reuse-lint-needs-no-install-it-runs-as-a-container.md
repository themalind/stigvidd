<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# `reuse lint` needs no local install — the CI job is a container, and the tag is `5`, not `v5`

CLAUDE.md and the `licensing` CI job both name `reuse lint` as the check, which reads as "install
the `reuse` tool". On a box without it the obvious next step is a Python install — pipx, a venv,
`pip install --user` — and none of that is necessary. The CI job is
[`fsfe/reuse-action@v5`](../../.github/workflows/ci.yml), and that action is a thin wrapper around
the **`fsfe/reuse` container image**. Running the image directly is the same check, byte for byte,
on any box with Docker.

## The invocation

```sh
docker run --rm --volume "$PWD:/data" \
  -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0=/data \
  fsfe/reuse:5 lint
```

On Windows the volume takes the native path: `--volume "D:\projekt\stigvidd:/data"`.

Two things in that line are not obvious, and each fails differently.

## 1. There is no `v5` tag

`fsfe/reuse-action@v5` is an **Actions ref**, not an image tag. Passing it to `docker run` exits
**125** with `not found`, which reads like a network or registry problem rather than a name that
was never going to resolve. The image's published tags are `5`, `5.1.1`, `6`, `6.2.0` and
`latest` — so `fsfe/reuse:5` is the one that matches what CI runs (5.1.1); `latest` is 6.2.0 and
reports the same result here.

## 2. Without the `safe.directory` env vars, reuse scans `node_modules`

Git refuses a repository owned by another user, which is what a bind-mounted checkout looks like
from inside the container. reuse then falls back to walking the tree itself instead of asking git,
so `node_modules`, `bin/` and `obj/` all become files it wants a licence for, and the run is both
slow and full of noise that has nothing to do with the repo. `git config safe.directory` cannot be
set from outside the container, but the `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_0` /
`GIT_CONFIG_VALUE_0` triple is the environment-variable form of exactly that, and it works where a
config file would have to be baked in.

## Do not hardcode the file count

CLAUDE.md said `1011/1011` for a long time; the tree measured **1252/1252** on 2026-09-12, and it
moves with every file added. The number is not the check — `Missing licenses: 0` is. Quote the
count only as a measurement with its date, never as a threshold something should match.

The run covers the whole **working tree**, uncommitted files included, so it answers "will the
licensing job pass" before anything is committed.

Related: [[licence-is-per-area-not-repo-wide]],
[[compose-up-needs-two-hand-carried-things-that-are-not-in-the-repo]].
