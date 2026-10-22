import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { AuthentikIdentity } from "../authentik-jwt.js";
import {
	type AuthentikAuthOptions,
	authenticateRequest,
} from "../request-auth.js";

export type { AuthentikAuthOptions };

/** `user` fica undefined com `optional` e sem JWT. `request.user` depois do plugin. Sem augmentation global para não colidir
 * com o `request.user` que o app já declara. */
export type AuthentikFastifyRequest = FastifyRequest & {
	user?: AuthentikIdentity;
};

const plugin: FastifyPluginAsync<AuthentikAuthOptions> = async (
	fastify,
	options,
) => {
	fastify.decorateRequest("user", undefined);

	// onRequest: recusa antes de o Fastify parsear o body de quem não tem sessão.
	fastify.addHook("onRequest", async (request, reply) => {
		const outcome = await authenticateRequest(request.headers, options);
		if (outcome.kind === "rejected") {
			return reply.code(401).send(outcome.body);
		}
		if (outcome.kind === "user") {
			(request as AuthentikFastifyRequest).user = outcome.user;
		}
	});
};

// O que o fastify-plugin faz, sem a dependência: tira o plugin do
// encapsulamento para o hook valer nas rotas do app inteiro, não só dentro
// do register.
Object.assign(plugin, {
	[Symbol.for("skip-override")]: true,
	[Symbol.for("fastify.display-name")]: "koch-authentik-auth",
});

export const authentikAuthPlugin = plugin;
