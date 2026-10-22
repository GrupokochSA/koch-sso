import { describe, expect, it, vi } from "vitest";
import { createRolesLookup, RolesLookupError } from "./roles-lookup.js";

const SERVICE_TOKEN = "service-token-service-token-1234";
const BASE_URL = "http://autenticacao.internal:3000";

// Formato real de GET /users/:username/roles da API `autenticacao`
// (src/app/routes/users/index.ts): CODGRUPO já vem como array.
const apiUser = {
	SEQUSUARIO: 1530,
	CODUSUARIO: "LEONARDONUNES",
	NOMEUSUARIOAD: "leonardo.nunes",
	NOME: "Leonardo Nunes",
	EMAIL: "leonardo.nunes@grupokochsa.com.br",
	NROEMPRESA: 1,
	NIVEL: 3,
	CODGRUPO: ["TI", "ADMIN"],
};

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function okResponse(user: unknown = apiUser) {
	return jsonResponse({ status: 200, message: "Usuário encontrado.", user });
}

describe("createRolesLookup", () => {
	it("chama GET {baseUrl}/users/:username/roles com x-service-token", async () => {
		const fetchMock = vi.fn().mockResolvedValue(okResponse());
		const lookup = createRolesLookup({
			baseUrl: BASE_URL,
			serviceToken: SERVICE_TOKEN,
			fetch: fetchMock,
		});

		await lookup("leonardo.nunes");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(`${BASE_URL}/users/leonardo.nunes/roles`);
		expect(init.method).toBe("GET");
		expect(init.headers).toMatchObject({ "x-service-token": SERVICE_TOKEN });
	});

	it("aceita baseUrl com barra no fim", async () => {
		const fetchMock = vi.fn().mockResolvedValue(okResponse());
		const lookup = createRolesLookup({
			baseUrl: `${BASE_URL}/`,
			serviceToken: SERVICE_TOKEN,
			fetch: fetchMock,
		});

		await lookup("leonardo.nunes");

		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			`${BASE_URL}/users/leonardo.nunes/roles`,
		);
	});

	it("devolve o usuário tipado com os campos do Consinco", async () => {
		const lookup = createRolesLookup({
			baseUrl: BASE_URL,
			serviceToken: SERVICE_TOKEN,
			fetch: vi.fn().mockResolvedValue(okResponse()),
		});

		await expect(lookup("leonardo.nunes")).resolves.toEqual(apiUser);
	});

	it("aceita campos opcionais nulos que o Oracle devolve", async () => {
		const lookup = createRolesLookup({
			baseUrl: BASE_URL,
			serviceToken: SERVICE_TOKEN,
			fetch: vi.fn().mockResolvedValue(
				okResponse({
					...apiUser,
					NOMEUSUARIOAD: null,
					EMAIL: null,
					NROEMPRESA: null,
				}),
			),
		});

		await expect(lookup("leonardo.nunes")).resolves.toMatchObject({
			NOMEUSUARIOAD: null,
			EMAIL: null,
			NROEMPRESA: null,
		});
	});

	it("404 devolve null: usuário do AD sem cadastro no Consinco", async () => {
		const lookup = createRolesLookup({
			baseUrl: BASE_URL,
			serviceToken: SERVICE_TOKEN,
			fetch: vi
				.fn()
				.mockResolvedValue(
					jsonResponse({ message: "Usuário não encontrado" }, 404),
				),
		});

		await expect(lookup("fulano")).resolves.toBeNull();
	});

	it.each([401, 500, 503])(
		"status %i lança RolesLookupError",
		async (status) => {
			const lookup = createRolesLookup({
				baseUrl: BASE_URL,
				serviceToken: SERVICE_TOKEN,
				fetch: vi.fn().mockResolvedValue(jsonResponse({}, status)),
			});

			const error = await lookup("leonardo.nunes").catch((e: unknown) => e);

			expect(error).toBeInstanceOf(RolesLookupError);
			expect((error as RolesLookupError).status).toBe(status);
		},
	);

	it("lança quando a resposta não tem o formato esperado", async () => {
		const lookup = createRolesLookup({
			baseUrl: BASE_URL,
			serviceToken: SERVICE_TOKEN,
			fetch: vi.fn().mockResolvedValue(okResponse({ CODUSUARIO: "X" })),
		});

		await expect(lookup("leonardo.nunes")).rejects.toBeInstanceOf(
			RolesLookupError,
		);
	});

	it("lança quando o corpo não é JSON", async () => {
		const lookup = createRolesLookup({
			baseUrl: BASE_URL,
			serviceToken: SERVICE_TOKEN,
			fetch: vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })),
		});

		await expect(lookup("leonardo.nunes")).rejects.toBeInstanceOf(
			RolesLookupError,
		);
	});

	it("falha de rede vira RolesLookupError", async () => {
		const lookup = createRolesLookup({
			baseUrl: BASE_URL,
			serviceToken: SERVICE_TOKEN,
			fetch: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
		});

		await expect(lookup("leonardo.nunes")).rejects.toBeInstanceOf(
			RolesLookupError,
		);
	});

	// O token é segredo: nem a mensagem do erro nem o cause podem carregá-lo.
	it("o erro nunca carrega o service token", async () => {
		const lookup = createRolesLookup({
			baseUrl: BASE_URL,
			serviceToken: SERVICE_TOKEN,
			fetch: vi
				.fn()
				.mockRejectedValue(new Error(`boom com ${SERVICE_TOKEN} dentro`)),
		});

		const error = (await lookup("leonardo.nunes").catch(
			(e: unknown) => e,
		)) as RolesLookupError;

		expect(error.message).not.toContain(SERVICE_TOKEN);
		expect(JSON.stringify(error)).not.toContain(SERVICE_TOKEN);
		expect(String(error.cause)).not.toContain(SERVICE_TOKEN);
	});

	// Username vai no path: sem validar, "../x" ou "a/b" reescreveria a rota.
	it.each(["", "a/b", "../admin", "a b", "x".repeat(65), "joão"])(
		"rejeita username inválido %j sem chamar a API",
		async (username) => {
			const fetchMock = vi.fn();
			const lookup = createRolesLookup({
				baseUrl: BASE_URL,
				serviceToken: SERVICE_TOKEN,
				fetch: fetchMock,
			});

			await expect(lookup(username)).rejects.toBeInstanceOf(RolesLookupError);
			expect(fetchMock).not.toHaveBeenCalled();
		},
	);

	describe("cache", () => {
		it("reaproveita a resposta dentro do TTL, sem diferenciar maiúsculas", async () => {
			const fetchMock = vi.fn().mockImplementation(async () => okResponse());
			const lookup = createRolesLookup({
				baseUrl: BASE_URL,
				serviceToken: SERVICE_TOKEN,
				fetch: fetchMock,
			});

			await lookup("Leonardo.Nunes");
			await lookup("leonardo.nunes");

			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it("consulta de novo depois do TTL (default 5 min)", async () => {
			let now = 1_000_000;
			const fetchMock = vi.fn().mockImplementation(async () => okResponse());
			const lookup = createRolesLookup({
				baseUrl: BASE_URL,
				serviceToken: SERVICE_TOKEN,
				fetch: fetchMock,
				now: () => now,
			});

			await lookup("leonardo.nunes");
			now += 5 * 60 * 1000 - 1;
			await lookup("leonardo.nunes");
			expect(fetchMock).toHaveBeenCalledTimes(1);

			now += 1;
			await lookup("leonardo.nunes");
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});

		it("respeita ttlMs customizado", async () => {
			let now = 0;
			const fetchMock = vi.fn().mockImplementation(async () => okResponse());
			const lookup = createRolesLookup({
				baseUrl: BASE_URL,
				serviceToken: SERVICE_TOKEN,
				fetch: fetchMock,
				ttlMs: 1000,
				now: () => now,
			});

			await lookup("leonardo.nunes");
			now += 1000;
			await lookup("leonardo.nunes");

			expect(fetchMock).toHaveBeenCalledTimes(2);
		});

		it("cacheia o 404, pra usuário sem cadastro não martelar a API", async () => {
			const fetchMock = vi
				.fn()
				.mockImplementation(async () => jsonResponse({}, 404));
			const lookup = createRolesLookup({
				baseUrl: BASE_URL,
				serviceToken: SERVICE_TOKEN,
				fetch: fetchMock,
			});

			await lookup("fulano");
			await expect(lookup("fulano")).resolves.toBeNull();

			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		// Cachear erro transitório trancaria o usuário fora por 5 minutos.
		it("não cacheia falha", async () => {
			const fetchMock = vi
				.fn()
				.mockResolvedValueOnce(jsonResponse({}, 503))
				.mockResolvedValueOnce(okResponse());
			const lookup = createRolesLookup({
				baseUrl: BASE_URL,
				serviceToken: SERVICE_TOKEN,
				fetch: fetchMock,
			});

			await expect(lookup("leonardo.nunes")).rejects.toBeInstanceOf(
				RolesLookupError,
			);
			await expect(lookup("leonardo.nunes")).resolves.toEqual(apiUser);
		});
	});
});
