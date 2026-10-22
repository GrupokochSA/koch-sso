/**
 * Cliente de `GET /users/:username/roles` da API `autenticacao`.
 *
 * O SSO entrega só username + grupos do AD; os dados do Consinco
 * (SEQUSUARIO, NIVEL, grupos de acesso) continuam vindo da `autenticacao`,
 * por token de serviço, sem senha. Formato conferido em
 * `autenticacao/src/app/routes/users/index.ts`.
 */
export interface ConsincoUser {
	SEQUSUARIO: number;
	CODUSUARIO: string;
	NOMEUSUARIOAD: string | null;
	NOME: string | null;
	EMAIL: string | null;
	NROEMPRESA: number | null;
	NIVEL: number;
	/** Já vem como lista da API (ela quebra o LISTAGG do Oracle por vírgula). */
	CODGRUPO: string[];
}

export interface RolesLookupOptions {
	/** Ex.: `http://autenticacao:3000`. Barra no fim é aceita. */
	baseUrl: string;
	/** Segredo compartilhado `SERVICE_TOKEN` da `autenticacao`. */
	serviceToken: string;
	/** Injetável para teste; default é o `fetch` global. */
	fetch?: typeof fetch;
	/** Default 5 min — o mesmo TTL do cache da própria `autenticacao`. */
	ttlMs?: number;
	timeoutMs?: number;
	now?: () => number;
}

// Nunca carrega o service token nem o `cause` original: o erro vai parar em
// log, e o que o fetch/JSON joga pode ecoar o que enviamos.
export class RolesLookupError extends Error {
	constructor(
		message: string,
		readonly status?: number,
	) {
		super(message);
		this.name = "RolesLookupError";
	}
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 5000;
// Mesma regra de `usernameParamSchema` da autenticacao. O username vai no
// path: sem validar, "../x" reescreveria a rota.
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

const nullableString = (value: unknown) =>
	value === null || typeof value === "string";
const nullableNumber = (value: unknown) =>
	value === null || typeof value === "number";

// Resposta de terceiro cruzando a fronteira: valida em vez de confiar no tipo.
function parseConsincoUser(body: unknown): ConsincoUser | undefined {
	if (!isRecord(body) || !isRecord(body.user)) return undefined;
	const u = body.user;
	if (
		typeof u.SEQUSUARIO !== "number" ||
		typeof u.CODUSUARIO !== "string" ||
		typeof u.NIVEL !== "number" ||
		!Array.isArray(u.CODGRUPO) ||
		!u.CODGRUPO.every((g) => typeof g === "string") ||
		!nullableString(u.NOMEUSUARIOAD) ||
		!nullableString(u.NOME) ||
		!nullableString(u.EMAIL) ||
		!nullableNumber(u.NROEMPRESA)
	) {
		return undefined;
	}
	return {
		SEQUSUARIO: u.SEQUSUARIO,
		CODUSUARIO: u.CODUSUARIO,
		NOMEUSUARIOAD: u.NOMEUSUARIOAD as string | null,
		NOME: u.NOME as string | null,
		EMAIL: u.EMAIL as string | null,
		NROEMPRESA: u.NROEMPRESA as number | null,
		NIVEL: u.NIVEL,
		CODGRUPO: u.CODGRUPO as string[],
	};
}

/**
 * Devolve `null` quando o usuário do AD não tem cadastro no Consinco (404);
 * lança `RolesLookupError` para qualquer outra falha. Cache em memória por
 * processo, por username sem diferenciar maiúsculas.
 */
export function createRolesLookup({
	baseUrl,
	serviceToken,
	fetch: fetchImpl = fetch,
	ttlMs = DEFAULT_TTL_MS,
	timeoutMs = DEFAULT_TIMEOUT_MS,
	now = Date.now,
}: RolesLookupOptions): (username: string) => Promise<ConsincoUser | null> {
	const root = baseUrl.replace(/\/+$/, "");
	const cache = new Map<
		string,
		{ expiresAt: number; user: ConsincoUser | null }
	>();

	return async (username) => {
		if (!USERNAME_PATTERN.test(username)) {
			throw new RolesLookupError("username inválido");
		}

		const key = username.toLowerCase();
		const hit = cache.get(key);
		if (hit && now() < hit.expiresAt) return hit.user;

		let response: Response;
		try {
			response = await fetchImpl(`${root}/users/${username}/roles`, {
				method: "GET",
				headers: { "x-service-token": serviceToken },
				signal: AbortSignal.timeout(timeoutMs),
			});
		} catch {
			throw new RolesLookupError("falha de rede ao consultar roles");
		}

		let user: ConsincoUser | null;
		if (response.status === 404) {
			// Cacheia o 404 também: usuário sem cadastro não pode martelar a API
			// a cada requisição.
			user = null;
		} else if (!response.ok) {
			throw new RolesLookupError(
				`autenticacao respondeu ${response.status}`,
				response.status,
			);
		} else {
			const parsed = parseConsincoUser(
				await response.json().catch(() => undefined),
			);
			if (!parsed) {
				throw new RolesLookupError("resposta fora do formato esperado");
			}
			user = parsed;
		}

		cache.set(key, { expiresAt: now() + ttlMs, user });
		return user;
	};
}
