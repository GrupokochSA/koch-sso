# @koch/authentik-auth

Valida o `X-authentik-jwt` que o outpost do authentik injeta via forwardAuth do
Traefik e entrega a identidade do usuário ao backend. Extraído do supply-message.
Dependência de runtime: só `jose`.

## Como adotar

1. **Compose:** no router do app, `traefik.http.routers.<app>.middlewares=authentik-forwardauth@file` (o forwardAuth vai primeiro na lista, se houver outros).
2. **Envs:** `AUTHENTIK_CLIENT_ID` e `AUTHENTIK_ISSUER` (não são segredo; saem do provider do app no authentik).
3. **Secret:** o client secret do provider vai como Swarm secret montado em `AUTHENTIK_PROXY_CLIENT_SECRET` (`source: <APP>_AUTHENTIK_CLIENT_SECRET`, `target: AUTHENTIK_PROXY_CLIENT_SECRET`). Nunca em compose, `.env` versionado ou linha de comando.
4. **Dependência:** `"@koch/authentik-auth": "github:GrupokochSA/koch-sso#path:/packages/authentik-auth&v0.1.0"` (pnpm; ver o README da raiz).
5. **Código:** monte a config uma vez e registre o adapter do seu framework (abaixo).

Passo a passo completo (provider, grupos, validação): `infra/authentik/COMO-PROTEGER-UM-APP.md`.

```ts
import { buildAuthentikJwtConfig } from "@koch/authentik-auth";

// `undefined` se faltar qualquer um dos três: o adapter então recusa tudo
// (401), em vez de deixar o app sem auth sem ninguém perceber.
export const authentikConfig = buildAuthentikJwtConfig({
	clientSecret: process.env.AUTHENTIK_PROXY_CLIENT_SECRET,
	clientId: process.env.AUTHENTIK_CLIENT_ID,
	issuer: process.env.AUTHENTIK_ISSUER,
});
```

## Identidade

`{ username, email?, name?, groups: string[] }`, tirada dos claims do JWT validado
(`preferred_username`, `email`, `name`, `groups`). `X-authentik-username` é só
conferência: se vier preenchido e divergir do claim, a requisição é recusada
(um JWT válido capturado não serve para outro usuário). JWT sem
`preferred_username` (provider sem property mappings) é recusado com 401, até em `optional`:
é configuração quebrada, não "sem SSO".

## Adapters

Todos recusam com **401** e `{ "error": { "code", "message" } }`:
`UNAUTHENTICATED` (sem JWT) ou `INVALID_AUTHENTIK_JWT` (JWT presente e inválido).
O motivo exato (`assinatura`, `aud`, `iss`, `exp`, `formato`, `identidade`) **não**
vai para o cliente: chega só ao `onReject`, para você logar. O token nunca aparece
em erro nem em log.

Opções comuns: `config`, `optional` (sem JWT segue anônimo, para cair na sessão
própria do app durante a migração; JWT inválido continua 401) e `onReject`.

Nenhum adapter declara `req.user` globalmente, para não colidir com o tipo que o
app (ou passport) já tem. Use os tipos exportados ou declare o seu (`user` é
opcional: fica `undefined` só com `optional` e sem JWT).

TS com `moduleResolution: node10` (comum em app Nest antigo) resolve os tipos dos
subpaths via `typesVersions`; `node16`/`nodenext`/`bundler` via `exports`.

### Express (4 ou 5)

```ts
import { authentikAuth, type AuthentikRequest } from "@koch/authentik-auth/express";

app.use(authentikAuth({ config: authentikConfig, onReject: (e) => logger.warn({ reason: e.reason }) }));
app.get("/me", (req, res) => res.json((req as AuthentikRequest).user));
```

### Fastify (5)

```ts
import { authentikAuthPlugin } from "@koch/authentik-auth/fastify";

app.get("/health", async () => "ok"); // público: fica FORA do escopo do plugin
await app.register(async (protectedScope) => {
	await protectedScope.register(authentikAuthPlugin, {
		config: authentikConfig,
		onReject: (e) => app.log.warn({ reason: e.reason }, "X-authentik-jwt recusado"),
	});
	protectedScope.get("/me", async (request) => (request as AuthentikFastifyRequest).user);
});
```

O hook vale para **todas** as rotas do escopo onde o plugin é registrado, inclusive as
declaradas antes. Para rota pública (health), registre-a fora desse escopo. Roda em
`onRequest`: recusa antes de parsear o body de quem não tem sessão.

### NestJS (11)

```ts
import { AuthentikGuard, AuthentikUser } from "@koch/authentik-auth/nest";

app.useGlobalGuards(new AuthentikGuard({ config: authentikConfig }));
// ou por controller: @UseGuards(new AuthentikGuard({ config: authentikConfig }))

@Get("me")
me(@AuthentikUser() user: AuthentikIdentity) { return user; }
```

O guard recebe a config no construtor (não lê env). Precisa de `experimentalDecorators`
no `tsconfig`, como todo app Nest.

### Sem adapter (Hono, Next route handler, etc.)

```ts
import { resolveAuthentikUser } from "@koch/authentik-auth";

// undefined = sem JWT (decida: cookie ou 401); lança AuthentikJwtError se inválido.
const user = await resolveAuthentikUser(request.headers, authentikConfig);
```

## Roles do Consinco (`@koch/authentik-auth/consinco`)

O SSO entrega username e grupos do AD. `SEQUSUARIO`, `NIVEL` e grupos de acesso do
Consinco continuam vindo da API `autenticacao` (`GET /users/:username/roles`, header
`x-service-token`, sem senha).

```ts
import { createRolesLookup } from "@koch/authentik-auth/consinco";

const lookupRoles = createRolesLookup({
	baseUrl: process.env.AUTENTICACAO_URL!,
	serviceToken: process.env.AUTENTICACAO_SERVICE_TOKEN!, // Swarm secret
	// ttlMs: 5 * 60 * 1000, timeoutMs: 5000, fetch: customFetch
});

const consinco = await lookupRoles(user.username);
// null = usuário do AD sem cadastro no Consinco. Falha = RolesLookupError.
// consinco?.CODUSUARIO, SEQUSUARIO, NIVEL, CODGRUPO (string[])...
```

- Cache em memória por processo, TTL de 5 min (o mesmo da `autenticacao`), sem
  diferenciar maiúsculas. Cacheia o 404; **não** cacheia erro.
- O username é validado (`[A-Za-z0-9._-]{1,64}`) antes de ir ao path.
- A resposta é validada na borda; formato fora do esperado vira `RolesLookupError`.
- O service token nunca entra em mensagem de erro nem em log.
- `autenticacao` e `active-directory-api` **nunca** recebem forwardAuth: ~60 backends
  as chamam server-to-server.

## Desenvolvimento

```bash
pnpm test      # vitest (adapters com supertest e fastify.inject)
pnpm build     # tsdown: ESM + CJS + d.ts em dist/
```
