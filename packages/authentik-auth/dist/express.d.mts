import { t as AuthentikIdentity } from "./authentik-jwt-BwxKuasp.mjs";
import { t as AuthentikAuthOptions } from "./request-auth-ByyVnHbI.mjs";
import { Request, RequestHandler } from "express";
//#region src/adapters/express.d.ts
/** `user` fica undefined com `optional` e sem JWT. `req.user` depois do middleware. Sem augmentation global para não colidir
 * com o `Request.user` que o app (ou passport) já declara. */
type AuthentikRequest = Request & {
  user?: AuthentikIdentity;
};
declare function authentikAuth(options: AuthentikAuthOptions): RequestHandler;
//#endregion
export { type AuthentikAuthOptions, AuthentikRequest, authentikAuth };