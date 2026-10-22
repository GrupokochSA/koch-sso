#!/usr/bin/env bash
# Publica uma versão consumível por git tag: `github:GrupokochSA/koch-sso#v<versão>&path:/packages/<pacote>`.
#
# O pnpm baixa só os arquivos listados em `files` de cada pacote, e `dist/` é
# gitignored. Rodar `prepare` na instalação não resolve: o pnpm 10+ exige que
# cada app consumidor liste o commit exato em `allowBuilds`. Por isso a tag
# aponta para um commit avulso (fora de qualquer branch) que carrega os
# `dist/` já buildados. A `main` continua sem artefato de build.
set -euo pipefail

version="${1:?uso: scripts/release.sh <versão sem o v, ex.: 0.1.0>}"
tag="v${version}"

cd "$(git rev-parse --show-toplevel)"

[ -z "$(git status --porcelain)" ] || { echo "árvore suja: commite antes" >&2; exit 1; }
git rev-parse -q --verify "refs/tags/${tag}" >/dev/null && { echo "tag ${tag} já existe" >&2; exit 1; }

for pkg in packages/*/package.json; do
	declared="$(node -p "require('./${pkg}').version")"
	[ "$declared" = "$version" ] || { echo "${pkg} está na ${declared}, não ${version}: suba a versão antes" >&2; exit 1; }
done

pnpm install --frozen-lockfile
pnpm lint
pnpm -r test
pnpm -r build

branch="$(git rev-parse --abbrev-ref HEAD)"
git checkout -q --detach
git add -f packages/*/dist
git commit -q -m "chore(release): ${tag}"
git tag "$tag"
git checkout -q "$branch"

echo "Tag ${tag} criada localmente. Para publicar: git push origin ${tag}"
