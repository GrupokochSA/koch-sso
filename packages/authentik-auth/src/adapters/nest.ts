import {
	type CanActivate,
	createParamDecorator,
	type ExecutionContext,
	UnauthorizedException,
} from "@nestjs/common";
import type {
	AuthentikIdentity,
	AuthentikRequestHeaders,
} from "../authentik-jwt.js";
import {
	type AuthentikAuthOptions,
	authenticateRequest,
} from "../request-auth.js";

export type { AuthentikAuthOptions };

interface RequestWithUser {
	headers: AuthentikRequestHeaders;
	user?: AuthentikIdentity;
}

/**
 * Uso: `@UseGuards(new AuthentikGuard({ config }))` ou
 * `app.useGlobalGuards(new AuthentikGuard({ config }))`. A config vem do
 * chamador porque o guard não lê env.
 */
export class AuthentikGuard implements CanActivate {
	constructor(private readonly options: AuthentikAuthOptions) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<RequestWithUser>();
		const outcome = await authenticateRequest(request.headers, this.options);

		if (outcome.kind === "rejected") {
			// O objeto vira o corpo da resposta 401: { error: { code, message } }.
			throw new UnauthorizedException(outcome.body);
		}
		if (outcome.kind === "user") request.user = outcome.user;
		return true;
	}
}

/** Parâmetro de handler com a identidade; `undefined` com `optional` e sem JWT. */
export const AuthentikUser = createParamDecorator(
	(_data: unknown, context: ExecutionContext) =>
		context.switchToHttp().getRequest<RequestWithUser>().user,
);
