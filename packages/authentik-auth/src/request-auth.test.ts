import { describe, expect, it, vi } from "vitest";
import type { AuthentikJwtError } from "./authentik-jwt.js";
import { authenticateRequest } from "./request-auth.js";
import { signProxyJwt, testConfig } from "./testing/proxy-jwt.js";

describe("authenticateRequest", () => {
	it("JWT válido devolve o usuário", async () => {
		const token = await signProxyJwt();

		await expect(
			authenticateRequest({ "x-authentik-jwt": token }, { config: testConfig }),
		).resolves.toEqual({
			kind: "user",
			user: { username: "leonardo.nunes", groups: [] },
		});
	});

	it("sem JWT recusa com UNAUTHENTICATED", async () => {
		await expect(
			authenticateRequest({}, { config: testConfig }),
		).resolves.toEqual({
			kind: "rejected",
			body: {
				error: {
					code: "UNAUTHENTICATED",
					message: "Autenticação necessária",
				},
			},
		});
	});

	// Config ausente = SSO mal configurado. Falhar aberto deixaria o app sem
	// auth sem ninguém perceber.
	it("sem config recusa em vez de liberar", async () => {
		const token = await signProxyJwt();

		const outcome = await authenticateRequest(
			{ "x-authentik-jwt": token },
			{ config: undefined },
		);

		expect(outcome.kind).toBe("rejected");
	});

	it("JWT inválido recusa com INVALID_AUTHENTIK_JWT sem revelar o motivo ao cliente", async () => {
		const outcome = await authenticateRequest(
			{ "x-authentik-jwt": "forjado.nao.valido" },
			{ config: testConfig },
		);

		expect(outcome).toEqual({
			kind: "rejected",
			body: {
				error: {
					code: "INVALID_AUTHENTIK_JWT",
					message: "Token do authentik inválido ou expirado",
				},
			},
		});
	});

	it("reporta o motivo da recusa a quem loga, nunca o token", async () => {
		const onReject = vi.fn();
		const token = await signProxyJwt({ expiresIn: "-1m" });

		await authenticateRequest(
			{ "x-authentik-jwt": token },
			{ config: testConfig, onReject },
		);

		expect(onReject).toHaveBeenCalledTimes(1);
		const [error] = onReject.mock.calls[0] as [AuthentikJwtError];
		expect(error.reason).toBe("exp");
		expect(error.message).not.toContain(token);
	});

	describe("optional", () => {
		it("sem JWT segue como anônimo, pro app cair no cookie dele", async () => {
			await expect(
				authenticateRequest({}, { config: testConfig, optional: true }),
			).resolves.toEqual({ kind: "anonymous" });
		});

		it("sem config segue como anônimo (SSO desligado)", async () => {
			await expect(
				authenticateRequest({}, { config: undefined, optional: true }),
			).resolves.toEqual({ kind: "anonymous" });
		});

		// Header presente com assinatura inválida é forjamento, não "sem SSO".
		it("JWT inválido continua recusado", async () => {
			const outcome = await authenticateRequest(
				{ "x-authentik-jwt": "forjado.nao.valido" },
				{ config: testConfig, optional: true },
			);

			expect(outcome.kind).toBe("rejected");
		});
	});
});
