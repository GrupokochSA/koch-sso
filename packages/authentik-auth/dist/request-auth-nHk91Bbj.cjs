const require_authentik_jwt = require("./authentik-jwt-DZxlLRej.cjs");
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
		user = await require_authentik_jwt.resolveAuthentikUser(headers, config);
	} catch (error) {
		if (!(error instanceof require_authentik_jwt.AuthentikJwtError)) throw error;
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
Object.defineProperty(exports, "authenticateRequest", {
	enumerable: true,
	get: function() {
		return authenticateRequest;
	}
});
