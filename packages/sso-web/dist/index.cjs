Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/navigate-fallback-denylist.ts
const NAVIGATE_FALLBACK_DENYLIST = [/^\/outpost\.goauthentik\.io\//, /^\/api\//];
//#endregion
//#region src/sso-recovery.ts
/**
* Atrás do forwardAuth do authentik, uma chamada à API sem sessão do outpost
* leva 302 cross-origin (auth-dev), não 401. O fetch segue o redirect, bate em
* HTML sem CORS e falha como erro de rede — e o app mostraria o form de login
* próprio, sem o SSO nunca ter chance de aparecer. Só uma navegação de verdade
* (reload) faz o browser seguir o 302 até o login do authentik.
*/
const RELOAD_FLAG_KEY = "koch-sso:reload";
const FETCH_NETWORK_MESSAGE = /failed to fetch|networkerror when attempting to fetch|load failed|network request failed/i;
/**
* Falha de rede, de axios ou de `fetch`. Timeout e cancelamento ficam de fora:
* têm outra causa e outro remédio.
*
* O erro do axios é reconhecido por `isAxiosError`/`code`, sem importar o
* axios: duas cópias dele no bundle quebrariam um `instanceof`, e app com
* fetch puro nem o tem instalado.
*/
function isNetworkFailure(error) {
	if (typeof error !== "object" || error === null) return false;
	if (error instanceof TypeError) return FETCH_NETWORK_MESSAGE.test(error.message);
	const candidate = error;
	return candidate.isAxiosError === true && candidate.response === void 0 && candidate.code === "ERR_NETWORK";
}
/**
* Recarrega uma única vez por sessão de aba. Se a página acabou de recarregar
* por isso e falhou de novo, a rede está fora mesmo: desarma e deixa o chamador
* seguir pro form de login. Storage bloqueado (modo privado, política) não
* recarrega — sem a marca não há como impedir o loop.
*/
function reloadOnceForSso(storage, reload) {
	try {
		if (storage.getItem(RELOAD_FLAG_KEY) === "1") {
			storage.removeItem(RELOAD_FLAG_KEY);
			return false;
		}
		storage.setItem(RELOAD_FLAG_KEY, "1");
	} catch {
		return false;
	}
	reload();
	return true;
}
function clearSsoReloadFlag(storage) {
	try {
		storage.removeItem(RELOAD_FLAG_KEY);
	} catch {}
}
//#endregion
exports.NAVIGATE_FALLBACK_DENYLIST = NAVIGATE_FALLBACK_DENYLIST;
exports.clearSsoReloadFlag = clearSsoReloadFlag;
exports.isNetworkFailure = isNetworkFailure;
exports.reloadOnceForSso = reloadOnceForSso;
