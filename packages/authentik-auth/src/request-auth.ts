import {
	type AuthentikIdentity,
	type AuthentikJwtConfig,
	AuthentikJwtError,
	type AuthentikRequestHeaders,
	resolveAuthentikUser,
} from "./authentik-jwt.js";

export interface AuthentikAuthOptions {
	/** `undefined` = SSO desligado (faltou secret, client id ou issuer). */
	config: AuthentikJwtConfig | undefined;
	/**
	 * Sem JWT segue como anônimo em vez de recusar, para o app cair na sessão
	 * própria dele durante a migração. JWT presente e inválido continua 401.
	 */
	optional?: boolean;
	/** Ponto de log da recusa: recebe só o motivo, nunca o token. */
	onReject?: (error: AuthentikJwtError) => void;
}

export interface AuthentikErrorBody {
	error: { code: string; message: string };
}

export type AuthenticationOutcome =
	| { kind: "user"; user: AuthentikIdentity }
	| { kind: "anonymous" }
	| { kind: "rejected"; body: AuthentikErrorBody };

const UNAUTHENTICATED: AuthentikErrorBody = {
	error: { code: "UNAUTHENTICATED", message: "Autenticação necessária" },
};

// Mensagem genérica de propósito: dizer ao cliente se falhou aud, iss ou
// assinatura ajuda quem tenta forjar. O motivo vai só para `onReject`.
const INVALID_AUTHENTIK_JWT: AuthentikErrorBody = {
	error: {
		code: "INVALID_AUTHENTIK_JWT",
		message: "Token do authentik inválido ou expirado",
	},
};

/** Núcleo comum dos adapters: decide o que fazer com uma requisição. */
export async function authenticateRequest(
	headers: AuthentikRequestHeaders,
	{ config, optional = false, onReject }: AuthentikAuthOptions,
): Promise<AuthenticationOutcome> {
	let user: AuthentikIdentity | undefined;
	try {
		user = await resolveAuthentikUser(headers, config);
	} catch (error) {
		if (!(error instanceof AuthentikJwtError)) throw error;
		onReject?.(error);
		return { kind: "rejected", body: INVALID_AUTHENTIK_JWT };
	}

	if (user) return { kind: "user", user };
	// Sem `optional`, "sem identidade" inclui SSO mal configurado: falhar
	// fechado é melhor que deixar o app sem auth sem ninguém perceber.
	return optional
		? { kind: "anonymous" }
		: { kind: "rejected", body: UNAUTHENTICATED };
}
