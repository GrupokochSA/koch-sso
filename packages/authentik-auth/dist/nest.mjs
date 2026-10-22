import { t as authenticateRequest } from "./request-auth-B-ldT3DQ.mjs";
import { UnauthorizedException, createParamDecorator } from "@nestjs/common";
//#region src/adapters/nest.ts
/**
* Uso: `@UseGuards(new AuthentikGuard({ config }))` ou
* `app.useGlobalGuards(new AuthentikGuard({ config }))`. A config vem do
* chamador porque o guard não lê env.
*/
var AuthentikGuard = class {
	options;
	constructor(options) {
		this.options = options;
	}
	async canActivate(context) {
		const request = context.switchToHttp().getRequest();
		const outcome = await authenticateRequest(request.headers, this.options);
		if (outcome.kind === "rejected") throw new UnauthorizedException(outcome.body);
		if (outcome.kind === "user") request.user = outcome.user;
		return true;
	}
};
/** Parâmetro de handler com a identidade; `undefined` com `optional` e sem JWT. */
const AuthentikUser = createParamDecorator((_data, context) => context.switchToHttp().getRequest().user);
//#endregion
export { AuthentikGuard, AuthentikUser };
