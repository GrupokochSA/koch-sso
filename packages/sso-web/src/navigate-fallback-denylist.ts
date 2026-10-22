// Caminhos que o service worker NÃO pode tratar como navegação do app.
// O fallback de navegação do workbox serve /index.html para qualquer rota; atrás do
// forwardAuth do authentik essa busca recebe 302 cross-origin e falha por CORS.
export const NAVIGATE_FALLBACK_DENYLIST: RegExp[] = [
	// Callback/sign_out do OIDC: roteado ao authentik pelo Traefik, nunca ao app.
	/^\/outpost\.goauthentik\.io\//,
	// Sem sessão a API responde 302 (não 401); não pode virar index.html.
	/^\/api\//,
];
