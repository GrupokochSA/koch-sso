//#region src/authentik-jwt.d.ts
/** `secret` = client secret do provider; `audience` = client id; `issuer` = issuer do provider. */
interface AuthentikJwtConfig {
  secret: Uint8Array;
  audience: string;
  issuer: string;
}
interface AuthentikIdentity {
  username: string;
  email?: string;
  name?: string;
  groups: string[];
}
type AuthentikJwtFailureReason = "assinatura" | "aud" | "iss" | "exp" | "formato" | "identidade";
declare class AuthentikJwtError extends Error {
  readonly reason: AuthentikJwtFailureReason;
  constructor(reason: AuthentikJwtFailureReason);
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
declare function verifyAuthentikJwt(token: string, config: AuthentikJwtConfig): Promise<Record<string, unknown>>;
type AuthentikRequestHeaders = Record<string, string | string[] | undefined>;
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
declare function resolveAuthentikUser(headers: AuthentikRequestHeaders, config: AuthentikJwtConfig | undefined): Promise<AuthentikIdentity | undefined>;
/** undefined quando falta qualquer um dos três — desliga o SSO. */
declare function buildAuthentikJwtConfig({ clientSecret, clientId, issuer }: {
  clientSecret: string | undefined;
  clientId: string | undefined;
  issuer: string | undefined;
}): AuthentikJwtConfig | undefined;
//#endregion
export { AuthentikRequestHeaders as a, verifyAuthentikJwt as c, AuthentikJwtFailureReason as i, AuthentikJwtConfig as n, buildAuthentikJwtConfig as o, AuthentikJwtError as r, resolveAuthentikUser as s, AuthentikIdentity as t };