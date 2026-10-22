Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const require_request_auth = require("./request-auth-nHk91Bbj.cjs");
let _nestjs_common = require("@nestjs/common");
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
		const outcome = await require_request_auth.authenticateRequest(request.headers, this.options);
		if (outcome.kind === "rejected") throw new _nestjs_common.UnauthorizedException(outcome.body);
		if (outcome.kind === "user") request.user = outcome.user;
		return true;
	}
};
/** Parâmetro de handler com a identidade; `undefined` com `optional` e sem JWT. */
const AuthentikUser = (0, _nestjs_common.createParamDecorator)((_data, context) => context.switchToHttp().getRequest().user);
//#endregion
exports.AuthentikGuard = AuthentikGuard;
exports.AuthentikUser = AuthentikUser;
