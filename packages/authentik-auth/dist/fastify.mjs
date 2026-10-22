import { t as authenticateRequest } from "./request-auth-B-ldT3DQ.mjs";
//#region src/adapters/fastify.ts
const plugin = async (fastify, options) => {
	fastify.decorateRequest("user", void 0);
	fastify.addHook("onRequest", async (request, reply) => {
		const outcome = await authenticateRequest(request.headers, options);
		if (outcome.kind === "rejected") return reply.code(401).send(outcome.body);
		if (outcome.kind === "user") request.user = outcome.user;
	});
};
Object.assign(plugin, {
	[Symbol.for("skip-override")]: true,
	[Symbol.for("fastify.display-name")]: "koch-authentik-auth"
});
const authentikAuthPlugin = plugin;
//#endregion
export { authentikAuthPlugin };
