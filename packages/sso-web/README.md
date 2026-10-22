# @koch/sso-web

Preset de frontend para apps atrás do forwardAuth do authentik. Sem dependências
de runtime (o axios não é importado: o erro é reconhecido por duck typing).
Extraído do supply-message#134.

## Como adotar

1. **Compose:** a label do forwardAuth é do backend (ver `@koch/authentik-auth`); o frontend servido pelo mesmo host herda a proteção.
2. **Envs:** nenhuma no frontend. `AUTHENTIK_CLIENT_ID`/`AUTHENTIK_ISSUER` e o secret `AUTHENTIK_PROXY_CLIENT_SECRET` ficam só no backend.
3. **Dependência:** `"@koch/sso-web": "github:GrupokochSA/koch-sso#path:/packages/sso-web&v0.1.0"` (pnpm; ver o README da raiz).
4. **Service worker (só se o app tem):** passe `NAVIGATE_FALLBACK_DENYLIST` ao workbox (abaixo).
5. **Chamada de "quem sou eu":** em `ERR_NETWORK`, recarregue uma vez com `reloadOnceForSso` (abaixo).

## Service worker (VitePWA)

O fallback de navegação do workbox serve `/index.html` para qualquer rota. Atrás do
forwardAuth essa busca leva 302 cross-origin e falha por CORS (`ERR_FAILED` no
`/outpost.goauthentik.io/callback`, com a aba anônima funcionando).

```ts
// vite.config.ts
import { NAVIGATE_FALLBACK_DENYLIST } from "@koch/sso-web";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
	plugins: [
		VitePWA({
			registerType: "autoUpdate",
			workbox: { navigateFallbackDenylist: NAVIGATE_FALLBACK_DENYLIST },
		}),
	],
});
```

A lista barra `/outpost.goauthentik.io/*` e `/api/*`. Se a API do app não vive em
`/api`, acrescente o prefixo dela: `[...NAVIGATE_FALLBACK_DENYLIST, /^\/v1\//]`.

## Recuperação de sessão

Com a sessão do outpost expirada, o `fetch` da API segue o 302, cai no HTML do
`auth-dev` sem CORS e falha como **erro de rede**, não 401. Sem tratamento o app
mostraria o form de login próprio e o SSO nunca apareceria. Só uma navegação de
verdade faz o browser seguir o 302 até o login.

```ts
import { clearSsoReloadFlag, isNetworkFailure, reloadOnceForSso } from "@koch/sso-web";

async function loadSession() {
	try {
		const me = await api.get("/api/auth/me"); // axios ou fetch
		clearSsoReloadFlag(sessionStorage); // sessão carregou: rearma o reload
		return me;
	} catch (error) {
		if (isNetworkFailure(error) && reloadOnceForSso(sessionStorage, () => location.reload())) {
			return new Promise<never>(() => {}); // a página vai recarregar; não renderize erro
		}
		throw error; // rede fora de verdade, ou 401 de outro motivo
	}
}
```

- `isNetworkFailure`: `ERR_NETWORK` do axios (sem resposta HTTP) e `TypeError` do
  `fetch` com a mensagem de rede dos browsers (`Failed to fetch`, `NetworkError when
  attempting to fetch resource.`, `Load failed`). Timeout e cancelamento ficam de fora.
- `reloadOnceForSso`: recarrega **uma vez** (marca em `sessionStorage`). Se a página
  acabou de recarregar e falhou de novo, desarma e devolve `false`. Storage bloqueado
  devolve `false` sem recarregar: sem a marca não há como evitar o loop.
- `clearSsoReloadFlag`: chame quando a sessão carregar.

## Desenvolvimento

```bash
pnpm test    # vitest
pnpm build   # tsdown: ESM + CJS + d.ts em dist/
```
