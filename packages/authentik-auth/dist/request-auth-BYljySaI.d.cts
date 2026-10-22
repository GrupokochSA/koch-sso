import { n as AuthentikJwtConfig, r as AuthentikJwtError } from "./authentik-jwt-BwxKuasp.cjs";
//#region src/request-auth.d.ts
interface AuthentikAuthOptions {
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
//#endregion
export { AuthentikAuthOptions as t };