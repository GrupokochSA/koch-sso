import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import {
	AuthentikJwtError,
	buildAuthentikJwtConfig,
	resolveAuthentikUser,
	verifyAuthentikJwt,
} from "./authentik-jwt.js";
import {
	CLIENT_ID,
	CLIENT_SECRET,
	testConfig as config,
	ISSUER,
	signProxyJwt,
} from "./testing/proxy-jwt.js";

async function reasonOf(promise: Promise<unknown>) {
	try {
		await promise;
	} catch (error) {
		expect(error).toBeInstanceOf(AuthentikJwtError);
		return (error as AuthentikJwtError).reason;
	}
	throw new Error("era esperado que a verificação falhasse");
}

describe("verifyAuthentikJwt", () => {
	it("aceita token HS256 assinado com o client secret, aud e iss certos", async () => {
		const token = await signProxyJwt();

		await expect(verifyAuthentikJwt(token, config)).resolves.toMatchObject({
			sub: "outpost-session-id",
		});
	});

	it("recusa token assinado com outro secret — motivo assinatura", async () => {
		const token = await signProxyJwt({
			secret: "outro-secret-outro-secret-outro-secret",
		});

		expect(await reasonOf(verifyAuthentikJwt(token, config))).toBe(
			"assinatura",
		);
	});

	it("recusa token de outro client — motivo aud", async () => {
		const token = await signProxyJwt({ audience: "outro-client" });

		expect(await reasonOf(verifyAuthentikJwt(token, config))).toBe("aud");
	});

	it("recusa token de outro issuer — motivo iss", async () => {
		const token = await signProxyJwt({
			issuer: "https://auth-dev.superkoch.com.br/application/o/outro-app/",
		});

		expect(await reasonOf(verifyAuthentikJwt(token, config))).toBe("iss");
	});

	it("recusa token expirado — motivo exp", async () => {
		const token = await signProxyJwt({ expiresIn: "-1m" });

		expect(await reasonOf(verifyAuthentikJwt(token, config))).toBe("exp");
	});

	// O jose só confere exp quando o claim existe — sem requiredClaims, um
	// token sem exp nunca expiraria.
	it("recusa token sem exp", async () => {
		const token = await new SignJWT({ sub: "outpost-session-id" })
			.setProtectedHeader({ alg: "HS256" })
			.setAudience(CLIENT_ID)
			.setIssuer(ISSUER)
			.setIssuedAt()
			.sign(new TextEncoder().encode(CLIENT_SECRET));

		expect(await reasonOf(verifyAuthentikJwt(token, config))).toBe("exp");
	});

	it("recusa lixo — motivo formato", async () => {
		expect(await reasonOf(verifyAuthentikJwt("nao-e-jwt", config))).toBe(
			"formato",
		);
	});

	// HS256 fixo: um token com outro alg nunca é aceito, mesmo que alguém
	// consiga montar um que "valide" com o secret como chave.
	it("recusa token com alg diferente de HS256", async () => {
		const token = await new SignJWT({ sub: "x" })
			.setProtectedHeader({ alg: "HS512" })
			.setAudience(CLIENT_ID)
			.setIssuer(ISSUER)
			.setExpirationTime("5m")
			.sign(new TextEncoder().encode(CLIENT_SECRET));

		expect(await reasonOf(verifyAuthentikJwt(token, config))).toBe(
			"assinatura",
		);
	});

	it("a mensagem do erro nunca carrega o token", async () => {
		const token = await signProxyJwt({ expiresIn: "-1m" });

		await expect(verifyAuthentikJwt(token, config)).rejects.not.toThrow(token);
	});
});

describe("buildAuthentikJwtConfig", () => {
	it("sem o client secret, desliga o SSO", () => {
		expect(
			buildAuthentikJwtConfig({
				clientSecret: undefined,
				clientId: CLIENT_ID,
				issuer: ISSUER,
			}),
		).toBeUndefined();
	});

	it("sem client id ou issuer, desliga o SSO", () => {
		expect(
			buildAuthentikJwtConfig({
				clientSecret: CLIENT_SECRET,
				clientId: undefined,
				issuer: ISSUER,
			}),
		).toBeUndefined();
		expect(
			buildAuthentikJwtConfig({
				clientSecret: CLIENT_SECRET,
				clientId: CLIENT_ID,
				issuer: undefined,
			}),
		).toBeUndefined();
	});
});

describe("resolveAuthentikUser", () => {
	it("SSO desligado ignora os headers", async () => {
		const token = await signProxyJwt();

		await expect(
			resolveAuthentikUser({ "x-authentik-jwt": token }, undefined),
		).resolves.toBeUndefined();
	});

	it("sem o header, devolve undefined pra quem chama decidir (cookie ou 401)", async () => {
		await expect(resolveAuthentikUser({}, config)).resolves.toBeUndefined();
	});

	it("só X-authentik-username, sem JWT, não autentica (header forjado)", async () => {
		await expect(
			resolveAuthentikUser(
				{ "x-authentik-username": "leonardo.nunes" },
				config,
			),
		).resolves.toBeUndefined();
	});

	it("tira a identidade dos claims do JWT validado", async () => {
		const token = await signProxyJwt({
			claims: {
				preferred_username: "leonardo.nunes",
				email: "leonardo.nunes@grupokochsa.com.br",
				name: "Leonardo Nunes",
				groups: ["TI", "Desenvolvimento"],
			},
		});

		await expect(
			resolveAuthentikUser({ "x-authentik-jwt": token }, config),
		).resolves.toEqual({
			username: "leonardo.nunes",
			email: "leonardo.nunes@grupokochsa.com.br",
			name: "Leonardo Nunes",
			groups: ["TI", "Desenvolvimento"],
		});
	});

	it("email, name e groups são opcionais; groups vira lista vazia", async () => {
		const token = await signProxyJwt();

		await expect(
			resolveAuthentikUser({ "x-authentik-jwt": token }, config),
		).resolves.toEqual({ username: "leonardo.nunes", groups: [] });
	});

	it("descarta claims com tipo errado em vez de repassar", async () => {
		const token = await signProxyJwt({
			claims: {
				preferred_username: "leonardo.nunes",
				email: 42,
				name: { x: 1 },
				groups: ["TI", 7, null],
			},
		});

		await expect(
			resolveAuthentikUser({ "x-authentik-jwt": token }, config),
		).resolves.toEqual({ username: "leonardo.nunes", groups: ["TI"] });
	});

	it("groups que não é lista vira lista vazia", async () => {
		const token = await signProxyJwt({
			claims: { preferred_username: "leonardo.nunes", groups: "TI" },
		});

		await expect(
			resolveAuthentikUser({ "x-authentik-jwt": token }, config),
		).resolves.toMatchObject({ groups: [] });
	});

	it("header X-authentik-username igual ao claim é aceito", async () => {
		const token = await signProxyJwt();

		await expect(
			resolveAuthentikUser(
				{ "x-authentik-jwt": token, "x-authentik-username": "leonardo.nunes" },
				config,
			),
		).resolves.toMatchObject({ username: "leonardo.nunes" });
	});

	// Um JWT válido capturado não pode servir para outro usuário.
	it("header X-authentik-username divergente do claim é recusado — motivo identidade", async () => {
		const token = await signProxyJwt();

		expect(
			await reasonOf(
				resolveAuthentikUser(
					{ "x-authentik-jwt": token, "x-authentik-username": "outra.pessoa" },
					config,
				),
			),
		).toBe("identidade");
	});

	// Provider sem property mappings: o outpost manda username em branco e o JWT
	// sai sem preferred_username. Aceitar isso autenticaria alguém sem dono.
	it("JWT válido sem preferred_username não autentica", async () => {
		const token = await signProxyJwt({ claims: {} });

		await expect(
			resolveAuthentikUser({ "x-authentik-jwt": token }, config),
		).resolves.toBeUndefined();
	});

	it("preferred_username em branco não autentica", async () => {
		const token = await signProxyJwt({
			claims: { preferred_username: "   " },
		});

		await expect(
			resolveAuthentikUser({ "x-authentik-jwt": token }, config),
		).resolves.toBeUndefined();
	});

	it.each(["", "   "])(
		"header de username em branco (%j) não conta como divergência",
		async (username) => {
			const token = await signProxyJwt();

			await expect(
				resolveAuthentikUser(
					{ "x-authentik-jwt": token, "x-authentik-username": username },
					config,
				),
			).resolves.toMatchObject({ username: "leonardo.nunes" });
		},
	);

	it("JWT presente mas inválido lança, não cai no cookie", async () => {
		await expect(
			resolveAuthentikUser(
				{
					"x-authentik-jwt": "forjado.nao.valido",
					"x-authentik-username": "leonardo.nunes",
				},
				config,
			),
		).rejects.toBeInstanceOf(AuthentikJwtError);
	});
});
