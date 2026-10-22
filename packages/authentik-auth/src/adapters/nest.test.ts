import "reflect-metadata";
import {
	Controller,
	Get,
	type INestApplication,
	Module,
	UseGuards,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthentikIdentity } from "../authentik-jwt.js";
import { signProxyJwt, testConfig } from "../testing/proxy-jwt.js";
import { AuthentikGuard, AuthentikUser } from "./nest.js";

const onReject = vi.fn();

@Controller()
@UseGuards(new AuthentikGuard({ config: testConfig, onReject }))
class ProtectedController {
	@Get("me")
	me(@AuthentikUser() user: AuthentikIdentity) {
		return { user };
	}
}

@Controller()
@UseGuards(new AuthentikGuard({ config: testConfig, optional: true }))
class OptionalController {
	@Get("maybe")
	maybe(@AuthentikUser() user: AuthentikIdentity | undefined) {
		return { user: user ?? null };
	}
}

@Module({ controllers: [ProtectedController, OptionalController] })
class AppModule {}

let app: INestApplication | undefined;

async function startApp() {
	const moduleRef = await Test.createTestingModule({
		imports: [AppModule],
	}).compile();
	app = moduleRef.createNestApplication();
	await app.init();
	return app.getHttpServer();
}

afterEach(async () => {
	await app?.close();
	app = undefined;
	onReject.mockClear();
});

describe("AuthentikGuard + @AuthentikUser (nest)", () => {
	it("injeta a identidade do JWT no parâmetro decorado", async () => {
		const server = await startApp();
		const token = await signProxyJwt({
			claims: { preferred_username: "leonardo.nunes", groups: ["TI"] },
		});

		const response = await request(server)
			.get("/me")
			.set("x-authentik-jwt", token);

		expect(response.status).toBe(200);
		expect(response.body.user).toEqual({
			username: "leonardo.nunes",
			groups: ["TI"],
		});
	});

	it("401 com { error: { code, message } } sem JWT", async () => {
		const server = await startApp();

		const response = await request(server).get("/me");

		expect(response.status).toBe(401);
		expect(response.body).toEqual({
			error: { code: "UNAUTHENTICATED", message: "Autenticação necessária" },
		});
	});

	it("401 com JWT inválido e chama onReject com o motivo", async () => {
		const server = await startApp();
		const token = await signProxyJwt({ audience: "outro-client" });

		const response = await request(server)
			.get("/me")
			.set("x-authentik-jwt", token);

		expect(response.status).toBe(401);
		expect(response.body.error.code).toBe("INVALID_AUTHENTIK_JWT");
		expect(onReject).toHaveBeenCalledWith(
			expect.objectContaining({ reason: "aud" }),
		);
	});

	it("401 quando X-authentik-username diverge do claim", async () => {
		const server = await startApp();
		const token = await signProxyJwt();

		const response = await request(server)
			.get("/me")
			.set("x-authentik-jwt", token)
			.set("x-authentik-username", "outra.pessoa");

		expect(response.status).toBe(401);
	});

	it("optional: sem JWT passa com usuário undefined", async () => {
		const server = await startApp();

		const response = await request(server).get("/maybe");

		expect(response.status).toBe(200);
		expect(response.body.user).toBeNull();
	});
});
