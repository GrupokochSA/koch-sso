let jose = require("jose");
//#region src/authentik-jwt.ts
var AuthentikJwtError = class extends Error {
	reason;
	constructor(reason) {
		super(`X-authentik-jwt recusado: ${reason}`);
		this.reason = reason;
		this.name = "AuthentikJwtError";
	}
};
function failureReasonOf(error) {
	if (error instanceof jose.errors.JWTExpired) return "exp";
	if (error instanceof jose.errors.JWTClaimValidationFailed) {
		if (error.claim === "aud") return "aud";
		if (error.claim === "iss") return "iss";
		if (error.claim === "exp") return "exp";
		return "formato";
	}
	if (error instanceof jose.errors.JWSSignatureVerificationFailed || error instanceof jose.errors.JOSEAlgNotAllowed) return "assinatura";
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
async function verifyAuthentikJwt(token, config) {
	try {
		const { payload } = await (0, jose.jwtVerify)(token, config.secret, {
			algorithms: ["HS256"],
			audience: config.audience,
			issuer: config.issuer,
			requiredClaims: [
				"exp",
				"aud",
				"iss"
			]
		});
		return payload;
	} catch (error) {
		throw new AuthentikJwtError(failureReasonOf(error));
	}
}
function nonBlankString(value) {
	return typeof value === "string" && value.trim() !== "" ? value : void 0;
}
function identityFromClaims(claims) {
	const username = nonBlankString(claims.preferred_username)?.trim();
	if (!username) throw new AuthentikJwtError("identidade");
	const email = nonBlankString(claims.email);
	const name = nonBlankString(claims.name);
	const groups = Array.isArray(claims.groups) ? claims.groups.filter((g) => typeof g === "string") : [];
	return {
		username,
		...email && { email },
		...name && { name },
		groups
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
async function resolveAuthentikUser(headers, config) {
	const jwt = headers["x-authentik-jwt"];
	if (!config || jwt === void 0) return void 0;
	if (typeof jwt !== "string") throw new AuthentikJwtError("formato");
	const identity = identityFromClaims(await verifyAuthentikJwt(jwt, config));
	const headerUsername = headers["x-authentik-username"];
	if (headerUsername !== void 0 && typeof headerUsername !== "string") throw new AuthentikJwtError("formato");
	if (headerUsername !== void 0 && headerUsername.trim() !== "" && headerUsername.trim() !== identity.username) throw new AuthentikJwtError("identidade");
	return identity;
}
/** undefined quando falta qualquer um dos três — desliga o SSO. */
function buildAuthentikJwtConfig({ clientSecret, clientId, issuer }) {
	if (!clientSecret || !clientId || !issuer) return;
	return {
		secret: new TextEncoder().encode(clientSecret),
		audience: clientId,
		issuer
	};
}
//#endregion
Object.defineProperty(exports, "AuthentikJwtError", {
	enumerable: true,
	get: function() {
		return AuthentikJwtError;
	}
});
Object.defineProperty(exports, "buildAuthentikJwtConfig", {
	enumerable: true,
	get: function() {
		return buildAuthentikJwtConfig;
	}
});
Object.defineProperty(exports, "resolveAuthentikUser", {
	enumerable: true,
	get: function() {
		return resolveAuthentikUser;
	}
});
Object.defineProperty(exports, "verifyAuthentikJwt", {
	enumerable: true,
	get: function() {
		return verifyAuthentikJwt;
	}
});
