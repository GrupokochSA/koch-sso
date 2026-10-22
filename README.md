# koch-sso

Pacotes compartilhados do SSO (authentik + Traefik forwardAuth) do Grupo Koch.

- `packages/authentik-auth` — valida `X-authentik-jwt` (HS256) e expõe `req.user`; adapters Express/Fastify/Nest; lookup de perfis Consinco na API `autenticacao`.
- `packages/sso-web` — preset de frontend: denylist do service worker e recuperação de sessão.

Decisão: GrupokochSA/traefik-proxy `docs/adr/0001-sso-forwardauth-authentik.md`. Guia: GrupokochSA/infra `authentik/COMO-PROTEGER-UM-APP.md`.
