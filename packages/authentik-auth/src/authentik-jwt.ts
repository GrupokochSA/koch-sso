import { errors, jwtVerify } from "jose";

/** `secret` = client secret do provider; `audience` = client id; `issuer` = issuer do provider. */
export interface AuthentikJwtConfig {
	secret: Uint8Array;
	audience: string;
	issuer: string;
}

export interface AuthentikIdentity {
	username: string;
	email?: string;
	name?: string;
	groups: string[];
}

export type AuthentikJwtFailureReason =
	| "assinatura"
	| "aud"
	| "iss"
	| "exp"
	| "formato"
	| "identidade";

// Carrega só o motivo — nunca o token nem a mensagem crua do jose, que pode
// ecoar claims.
export class AuthentikJwtError extends Error {
	constructor(readonly reason: AuthentikJwtFailureReason) {
		super(`X-authentik-jwt recusado: ${reason}`);
		this.name = "AuthentikJwtError";
	}
}

function failureReasonOf(error: unknown): AuthentikJwtFailureReason {
	if (error instanceof errors.JWTExpired) return "exp";
	if (error instanceof errors.JWTClaimValidationFailed) {
		if (error.claim === "aud") return "aud";
		if (error.claim === "iss") return "iss";
		if (error.claim === "exp") return "exp";
		return "formato";
	}
	// Alg diferente de HS256 também é assinatura que não confere com o secret.
	if (
		error instanceof errors.JWSSignatureVerificationFailed ||
		error instanceof errors.JOSEAlgNotAllowed
	) {
		return "assinatura";
	}
	return "formato";
}

/**
 * Valida assinatura, aud, iss e exp do X-authentik-jwt do forwardAuth.
 *
 * O proxy provider do authentik 2024.8.3 assina esse JWT com HS256 usando o
 * client secret do provider — o JWKS da aplicação volta `{}`, então conferir
 * por JWKS recusa toda requisição. `algorithms: ["HS256"]` é fixo: o secret é
 * a chave, e aceitar outro alg abriria confusão de algoritmo.
 *
 * A assinatura prova que a requisição passou de fato pelo outpost, fechando o
 * bypass por header forjado direto no backend (qualquer container na mesma
 * overlay alcança o app sem passar pelo Traefik).
 */
export async function verifyAuthentikJwt(
	token: string,
	config: AuthentikJwtConfig,
): Promise<Record<string, unknown>> {
	try {
		const { payload } = await jwtVerify(token, config.secret, {
			algorithms: ["HS256"],
			audience: config.audience,
			issuer: config.issuer,
			// O jose só confere exp/aud/iss quando o claim existe — sem isto um
			// token sem exp nunca expiraria.
			requiredClaims: ["exp", "aud", "iss"],
		});
		return payload;
	} catch (error) {
		throw new AuthentikJwtError(failureReasonOf(error));
	}
}

export type AuthentikRequestHeaders = Record<
	string,
	string | string[] | undefined
>;

function nonBlankString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function identityFromClaims(
	claims: Record<string, unknown>,
): AuthentikIdentity {
	const username = nonBlankString(claims.preferred_username)?.trim();
	// Provider sem property mappings de escopo emite o JWT sem
	// preferred_username; aceitar isso criaria sessão autenticada sem dono.
	if (!username) throw new AuthentikJwtError("identidade");

	const email = nonBlankString(claims.email);
	const name = nonBlankString(claims.name);
	const groups = Array.isArray(claims.groups)
		? claims.groups.filter((g): g is string => typeof g === "string")
		: [];

	return {
		username,
		...(email && { email }),
		...(name && { name }),
		groups,
	};
}

/**
 * Lê a identidade do SSO a partir dos headers do forwardAuth.
 * `undefined` quando a requisição não passou pelo outpost (sem o JWT, ou SSO
 * desligado porque `config` é undefined) — quem chama decide o que fazer
 * (cair pro cookie, ou recusar). Lança `AuthentikJwtError` quando o JWT está
 * presente mas não confere: presença de header sem token válido é sinal de
 * forjamento, não de "sem SSO".
 *
 * A identidade vem dos claims do JWT validado. `X-authentik-username` é só
 * conferência: se vier preenchido e divergir do claim, recusa — senão um JWT
 * válido capturado serviria para se passar por outro usuário.
 */
export async function resolveAuthentikUser(
	headers: AuthentikRequestHeaders,
	config: AuthentikJwtConfig | undefined,
): Promise<AuthentikIdentity | undefined> {
	const jwt = headers["x-authentik-jwt"];
	if (!config || jwt === undefined) return undefined;
	// Presente e não-string (header repetido entregue como array) é forjamento
	// possível, não "sem SSO": em `optional` virar anônimo seria bypass.
	if (typeof jwt !== "string") throw new AuthentikJwtError("formato");

	const claims = await verifyAuthentikJwt(jwt, config);
	const identity = identityFromClaims(claims);

	const headerUsername = headers["x-authentik-username"];
	if (headerUsername !== undefined && typeof headerUsername !== "string") {
		throw new AuthentikJwtError("formato");
	}
	if (
		headerUsername !== undefined &&
		headerUsername.trim() !== "" &&
		headerUsername.trim() !== identity.username
	) {
		throw new AuthentikJwtError("identidade");
	}

	return identity;
}

/** undefined quando falta qualquer um dos três — desliga o SSO. */
export function buildAuthentikJwtConfig({
	clientSecret,
	clientId,
	issuer,
}: {
	clientSecret: string | undefined;
	clientId: string | undefined;
	issuer: string | undefined;
}): AuthentikJwtConfig | undefined {
	if (!clientSecret || !clientId || !issuer) {
		return undefined;
	}
	return {
		secret: new TextEncoder().encode(clientSecret),
		audience: clientId,
		issuer,
	};
}
