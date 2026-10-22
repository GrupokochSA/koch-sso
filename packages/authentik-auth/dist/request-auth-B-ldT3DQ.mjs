import { r as resolveAuthentikUser, t as AuthentikJwtError } from "./authentik-jwt-BYoFWVmb.mjs";
//#region src/request-auth.ts
const UNAUTHENTICATED = { error: {
	code: "UNAUTHENTICATED",
	message: "Autenticação necessária"
} };
const INVALID_AUTHENTIK_JWT = { error: {
	code: "INVALID_AUTHENTIK_JWT",
	message: "Token do authentik inválido ou expirado"
} };
/** Núcleo comum dos adapters: decide o que fazer com uma requisição. */
async function authenticateRequest(headers, { config, optional = false, onReject }) {
	let user;
	try {
		user = await resolveAuthentikUser(headers, config);
	} catch (error) {
		if (!(error instanceof AuthentikJwtError)) throw error;
		onReject?.(error);
		return {
			kind: "rejected",
			body: INVALID_AUTHENTIK_JWT
		};
	}
	if (user) return {
		kind: "user",
		user
	};
	return optional ? { kind: "anonymous" } : {
		kind: "rejected",
		body: UNAUTHENTICATED
	};
}
//#endregion
export { authenticateRequest as t };
