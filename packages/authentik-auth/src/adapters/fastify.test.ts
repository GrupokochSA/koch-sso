import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { signProxyJwt, testConfig } from "../testing/proxy-jwt.js";
import { authentikAuthPlugin } from "./fastify.js";

async function buildApp(options: Parameters<typeof authentikAuthPlugin>[1]) {
	const app = Fastify();
	await app.register(authentikAuthPlugin, options);
	app.get("/me", async (request) => ({
		user: (request as { user?: unknown }).user ?? null,
	}));
	return app;
}

describe("authentikAuthPlugin (fastify)", () => {
	it("popula request.user com a identidade do JWT em rotas do app inteiro", async () => {
		const app = await buildApp({ config: testConfig });
		const token = await signProxyJwt({
			claims: { preferred_username: "leonardo.nunes", groups: ["TI"] },
		});

		const response = await app.inject({
			method: "GET",
			url: "/me",
			headers: { "x-authentik-jwt": token },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json().user).toEqual({
			username: "leonardo.nunes",
			groups: ["TI"],
		});
	});

	it("401 com { error: { code, message } } sem JWT", async () => {
		const app = await buildApp({ config: testConfig });

		const response = await app.inject({ method: "GET", url: "/me" });

		expect(response.statusCode).toBe(401);
		expect(response.json()).toEqual({
			error: { code: "UNAUTHENTICATED", message: "Autenticação necessária" },
		});
	});

	it("401 com JWT inválido e chama onReject com o motivo", async () => {
		const onReject = vi.fn();
		const app = await buildApp({ config: testConfig, onReject });
		const token = await signProxyJwt({ expiresIn: "-1m" });

		const response = await app.inject({
			method: "GET",
			url: "/me",
			headers: { "x-authentik-jwt": token },
		});

		expect(response.statusCode).toBe(401);
		expect(response.json().error.code).toBe("INVALID_AUTHENTIK_JWT");
		expect(onReject).toHaveBeenCalledWith(
			expect.objectContaining({ reason: "exp" }),
		);
	});

	it("401 quando X-authentik-username diverge do claim", async () => {
		const app = await buildApp({ config: testConfig });
		const token = await signProxyJwt();

		const response = await app.inject({
			method: "GET",
			url: "/me",
			headers: {
				"x-authentik-jwt": token,
				"x-authentik-username": "outra.pessoa",
			},
		});

		expect(response.statusCode).toBe(401);
	});

	it("optional: sem JWT passa sem request.user", async () => {
		const app = await buildApp({ config: testConfig, optional: true });

		const response = await app.inject({ method: "GET", url: "/me" });

		expect(response.statusCode).toBe(200);
		expect(response.json().user).toBeNull();
	});
});
