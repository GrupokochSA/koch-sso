import { t as AuthentikAuthOptions } from "./request-auth-ByyVnHbI.mjs";
import { CanActivate, ExecutionContext } from "@nestjs/common";
//#region src/adapters/nest.d.ts
/**
 * Uso: `@UseGuards(new AuthentikGuard({ config }))` ou
 * `app.useGlobalGuards(new AuthentikGuard({ config }))`. A config vem do
 * chamador porque o guard não lê env.
 */
declare class AuthentikGuard implements CanActivate {
  private readonly options;
  constructor(options: AuthentikAuthOptions);
  canActivate(context: ExecutionContext): Promise<boolean>;
}
/** Parâmetro de handler com a identidade; `undefined` com `optional` e sem JWT. */
declare const AuthentikUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
//#endregion
export { type AuthentikAuthOptions, AuthentikGuard, AuthentikUser };