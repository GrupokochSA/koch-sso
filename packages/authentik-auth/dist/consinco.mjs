//#region src/consinco/roles-lookup.ts
var RolesLookupError = class extends Error {
	status;
	constructor(message, status) {
		super(message);
		this.status = status;
		this.name = "RolesLookupError";
	}
};
const DEFAULT_TTL_MS = 3e5;
const DEFAULT_TIMEOUT_MS = 5e3;
const DEFAULT_MAX_ENTRIES = 1e3;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const DOTS_ONLY = /^\.+$/;
function isRecord(value) {
	return typeof value === "object" && value !== null;
}
const nullableString = (value) => value === null || typeof value === "string";
const nullableNumber = (value) => value === null || typeof value === "number";
function parseConsincoUser(body) {
	if (!isRecord(body) || !isRecord(body.user)) return void 0;
	const u = body.user;
	if (typeof u.SEQUSUARIO !== "number" || typeof u.CODUSUARIO !== "string" || typeof u.NIVEL !== "number" || !Array.isArray(u.CODGRUPO) || !u.CODGRUPO.every((g) => typeof g === "string") || !nullableString(u.NOMEUSUARIOAD) || !nullableString(u.NOME) || !nullableString(u.EMAIL) || !nullableNumber(u.NROEMPRESA)) return;
	return {
		SEQUSUARIO: u.SEQUSUARIO,
		CODUSUARIO: u.CODUSUARIO,
		NOMEUSUARIOAD: u.NOMEUSUARIOAD,
		NOME: u.NOME,
		EMAIL: u.EMAIL,
		NROEMPRESA: u.NROEMPRESA,
		NIVEL: u.NIVEL,
		CODGRUPO: u.CODGRUPO
	};
}
/**
* Devolve `null` quando o usuário do AD não tem cadastro no Consinco (404);
* lança `RolesLookupError` para qualquer outra falha. Cache em memória por
* processo, por username sem diferenciar maiúsculas.
*/
function createRolesLookup({ baseUrl, serviceToken, fetch: fetchImpl = fetch, ttlMs = DEFAULT_TTL_MS, timeoutMs = DEFAULT_TIMEOUT_MS, maxEntries = DEFAULT_MAX_ENTRIES, now = Date.now }) {
	const root = baseUrl.replace(/\/+$/, "");
	const cache = /* @__PURE__ */ new Map();
	return async (username) => {
		if (!USERNAME_PATTERN.test(username) || DOTS_ONLY.test(username)) throw new RolesLookupError("username inválido");
		const key = username.toLowerCase();
		const hit = cache.get(key);
		if (hit && now() < hit.expiresAt) return hit.user;
		let response;
		try {
			response = await fetchImpl(`${root}/users/${key}/roles`, {
				method: "GET",
				redirect: "error",
				headers: { "x-service-token": serviceToken },
				signal: AbortSignal.timeout(timeoutMs)
			});
		} catch {
			throw new RolesLookupError("falha de rede ao consultar roles");
		}
		let user;
		if (response.status === 404) user = null;
		else if (!response.ok) throw new RolesLookupError(`autenticacao respondeu ${response.status}`, response.status);
		else {
			const parsed = parseConsincoUser(await response.json().catch(() => void 0));
			if (!parsed) throw new RolesLookupError("resposta fora do formato esperado");
			user = parsed;
		}
		if (cache.size >= maxEntries && !cache.has(key)) {
			const oldest = cache.keys().next().value;
			if (oldest !== void 0) cache.delete(oldest);
		}
		cache.set(key, {
			expiresAt: now() + ttlMs,
			user
		});
		return user;
	};
}
//#endregion
export { RolesLookupError, createRolesLookup };
