import { describe, expect, it } from "vitest";
import { NAVIGATE_FALLBACK_DENYLIST } from "./navigate-fallback-denylist.js";

const isDenied = (pathname: string) =>
	NAVIGATE_FALLBACK_DENYLIST.some((pattern) => pattern.test(pathname));

describe("NAVIGATE_FALLBACK_DENYLIST", () => {
	it("deixa o callback do authentik ir à rede", () => {
		expect(isDenied("/outpost.goauthentik.io/callback")).toBe(true);
		expect(isDenied("/outpost.goauthentik.io/start")).toBe(true);
		expect(isDenied("/outpost.goauthentik.io/sign_out")).toBe(true);
	});

	it("deixa a API ir à rede", () => {
		expect(isDenied("/api/orders")).toBe(true);
	});

	it("não barra rotas do app", () => {
		expect(isDenied("/")).toBe(false);
		expect(isDenied("/orders")).toBe(false);
		expect(isDenied("/history/123")).toBe(false);
	});

	it("não barra rota que só contém o prefixo no meio do path", () => {
		expect(isDenied("/orders/api/x")).toBe(false);
		expect(isDenied("/apidocs")).toBe(false);
	});
});
