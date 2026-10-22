import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { signProxyJwt, testConfig } from "../testing/proxy-jwt.js";
import { authentikAuth } from "./express.js";

function buildApp(options: Parameters<typeof authentikAuth>[0]) {
	const app = express();
	app.use(authentikAuth(options));
	app.get("/me", (req, res) => {
		res.json({ user: (req as { user?: unknown }).user ?? null });
	});
	return app;
}

describe("authentikAuth (express)", () => {
	it("popula req.user com a identidade do JWT", async () => {
		const token = await signProxyJwt({
			claims: {
				preferred_username: "leonardo.nunes",
				email: "leonardo.nunes@grupokochsa.com.br",
				groups: ["TI"],
			},
		});

		const response = await request(buildApp({ config: testConfig }))
			.get("/me")
			.set("x-authentik-jwt", token);

		expect(response.status).toBe(200);
		expect(response.body.user).toEqual({
			username: "leonardo.nunes",
			email: "leonardo.nunes@grupokochsa.com.br",
			groups: ["TI"],
		});
	});

	it("401 com { error: { code, message } } sem JWT", async () => {
		const response = await request(buildApp({ config: testConfig })).get("/me");

		expect(response.status).toBe(401);
		expect(response.body).toEqual({
			error: { code: "UNAUTHENTICATED", message: "Autenticação necessária" },
		});
	});

	it("401 só com X-authentik-username forjado", async () => {
		const response = await request(buildApp({ config: testConfig }))
			.get("/me")
			.set("x-authentik-username", "leonardo.nunes");

		expect(response.status).toBe(401);
	});

	it("401 com JWT assinado por outro secret, e chama onReject sem vazar o token", async () => {
		const onReject = vi.fn();
		const token = await signProxyJwt({
			secret: "outro-secret-outro-secret-xx",
		});

		const response = await request(buildApp({ config: testConfig, onReject }))
			.get("/me")
			.set("x-authentik-jwt", token);

		expect(response.status).toBe(401);
		expect(response.body.error.code).toBe("INVALID_AUTHENTIK_JWT");
		expect(JSON.stringify(response.body)).not.toContain(token);
		expect(onReject).toHaveBeenCalledWith(
			expect.objectContaining({ reason: "assinatura" }),
		);
	});

	it("401 quando X-authentik-username diverge do claim", async () => {
		const token = await signProxyJwt();

		const response = await request(buildApp({ config: testConfig }))
			.get("/me")
			.set("x-authentik-jwt", token)
			.set("x-authentik-username", "outra.pessoa");

		expect(response.status).toBe(401);
	});

	it("optional: sem JWT passa sem req.user", async () => {
		const response = await request(
			buildApp({ config: testConfig, optional: true }),
		).get("/me");

		expect(response.status).toBe(200);
		expect(response.body.user).toBeNull();
	});
});
