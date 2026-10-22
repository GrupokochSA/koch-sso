import { SignJWT } from "jose";
import {
	type AuthentikJwtConfig,
	buildAuthentikJwtConfig,
} from "../authentik-jwt.js";

export const CLIENT_ID = "meuapp-hml-client";
export const ISSUER =
	"https://auth-dev.superkoch.com.br/application/o/meuapp-hml/";
export const CLIENT_SECRET = "client-secret-client-secret-client-secret";

export const testConfig = buildAuthentikJwtConfig({
	clientSecret: CLIENT_SECRET,
	clientId: CLIENT_ID,
	issuer: ISSUER,
}) as AuthentikJwtConfig;

// O proxy provider do authentik 2024.8 assina o X-authentik-jwt com HS256
// usando o client secret do provider — é isso que os testes reproduzem.
export function signProxyJwt({
	secret = CLIENT_SECRET,
	audience = CLIENT_ID,
	issuer = ISSUER,
	expiresIn = "5m",
	claims = { preferred_username: "leonardo.nunes" },
}: {
	secret?: string;
	audience?: string;
	issuer?: string;
	expiresIn?: string;
	claims?: Record<string, unknown>;
} = {}) {
	return new SignJWT({ sub: "outpost-session-id", ...claims })
		.setProtectedHeader({ alg: "HS256" })
		.setAudience(audience)
		.setIssuer(issuer)
		.setIssuedAt()
		.setExpirationTime(expiresIn)
		.sign(new TextEncoder().encode(secret));
}
