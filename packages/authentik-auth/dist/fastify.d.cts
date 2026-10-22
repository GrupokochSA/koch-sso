import { t as AuthentikIdentity } from "./authentik-jwt-BwxKuasp.cjs";
import { t as AuthentikAuthOptions } from "./request-auth-BYljySaI.cjs";
import { FastifyPluginAsync, FastifyRequest } from "fastify";
//#region src/adapters/fastify.d.ts
/** `user` fica undefined com `optional` e sem JWT. `request.user` depois do plugin. Sem augmentation global para não colidir
 * com o `request.user` que o app já declara. */
type AuthentikFastifyRequest = FastifyRequest & {
  user?: AuthentikIdentity;
};
declare const authentikAuthPlugin: FastifyPluginAsync<AuthentikAuthOptions>;
//#endregion
export { type AuthentikAuthOptions, AuthentikFastifyRequest, authentikAuthPlugin };