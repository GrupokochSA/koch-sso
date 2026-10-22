# koch-sso

Pacotes compartilhados do SSO (authentik + Traefik forwardAuth) do Grupo Koch.

| Pacote | O que faz |
|---|---|
| [`@koch/authentik-auth`](packages/authentik-auth) | Valida `X-authentik-jwt` (HS256) e expõe a identidade (`username`, `email`, `name`, `groups`); adapters Express, Fastify e Nest; lookup de roles do Consinco na API `autenticacao`. |
| [`@koch/sso-web`](packages/sso-web) | Preset de frontend: denylist do service worker e recuperação de sessão (reload único em falha de rede). |

Decisão: `GrupokochSA/traefik-proxy`, `docs/adr/0001-sso-forwardauth-authentik.md`.
Passo a passo para proteger um app: `GrupokochSA/infra`, `authentik/COMO-PROTEGER-UM-APP.md`.

## Consumir (enquanto não há registry)

Os pacotes são consumidos por git tag, com o pnpm:

```json
{
	"dependencies": {
		"@koch/authentik-auth": "github:GrupokochSA/koch-sso#path:/packages/authentik-auth&v0.1.0",
		"@koch/sso-web": "github:GrupokochSA/koch-sso#path:/packages/sso-web&v0.1.0"
	}
}
```

- O pnpm suporta `path:` em git deps (testado: a ordem `path:...&v0.1.0` e `v0.1.0&path:...` funcionam; o `path:` leva `/` inicial). **npm e yarn não** têm o mesmo suporte a subdiretório; para eles a saída é publicar no GitHub Packages (`@koch` como escopo da org).
- A tag aponta para um commit **avulso que carrega os `dist/`**, porque o pnpm só instala o que o pacote lista em `files`. Rodar `prepare` na instalação não serve: o pnpm 10+ exige que cada app liste o commit exato em `allowBuilds`.
- Atualizar = trocar a tag no `package.json` do app.

## Publicar uma versão

```bash
# 1. suba "version" nos package.json dos dois pacotes e mergeie na main
git checkout main && git pull
scripts/release.sh 0.2.0   # lint + testes + build, commit avulso com dist/ e tag v0.2.0
git push origin v0.2.0
```

O script recusa árvore suja, tag repetida ou `version` diferente da tag.

## Desenvolvimento

Node 22+ e pnpm (versão em `packageManager`).

```bash
pnpm install
pnpm lint          # biome ci
pnpm check-types   # tsc --noEmit
pnpm -r test       # vitest
pnpm -r build      # tsdown: ESM + CJS + d.ts
```

Biome não formata `*.md` nem o lockfile. CI: `.github/workflows/ci.yml` (runner `ci-cd`).
