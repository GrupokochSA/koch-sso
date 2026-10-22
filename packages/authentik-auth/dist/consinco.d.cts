//#region src/consinco/roles-lookup.d.ts
/**
 * Cliente de `GET /users/:username/roles` da API `autenticacao`.
 *
 * O SSO entrega só username + grupos do AD; os dados do Consinco
 * (SEQUSUARIO, NIVEL, grupos de acesso) continuam vindo da `autenticacao`,
 * por token de serviço, sem senha. Formato conferido em
 * `autenticacao/src/app/routes/users/index.ts`.
 */
interface ConsincoUser {
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
interface RolesLookupOptions {
  /** Ex.: `http://autenticacao:3000`. Barra no fim é aceita. */
  baseUrl: string;
  /** Segredo compartilhado `SERVICE_TOKEN` da `autenticacao`. */
  serviceToken: string;
  /** Injetável para teste; default é o `fetch` global. */
  fetch?: typeof fetch;
  /** Default 5 min — o mesmo TTL do cache da própria `autenticacao`. */
  ttlMs?: number;
  timeoutMs?: number;
  /** Teto do cache; estourou, descarta a entrada mais antiga. Default 1000. */
  maxEntries?: number;
  now?: () => number;
}
declare class RolesLookupError extends Error {
  readonly status?: number | undefined;
  constructor(message: string, status?: number | undefined);
}
/**
 * Devolve `null` quando o usuário do AD não tem cadastro no Consinco (404);
 * lança `RolesLookupError` para qualquer outra falha. Cache em memória por
 * processo, por username sem diferenciar maiúsculas.
 */
declare function createRolesLookup({ baseUrl, serviceToken, fetch: fetchImpl, ttlMs, timeoutMs, maxEntries, now }: RolesLookupOptions): (username: string) => Promise<ConsincoUser | null>;
//#endregion
export { type ConsincoUser, RolesLookupError, type RolesLookupOptions, createRolesLookup };