import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";
import {
	clearSsoReloadFlag,
	isNetworkFailure,
	reloadOnceForSso,
} from "./sso-recovery.js";

const config = {} as InternalAxiosRequestConfig;
const FLAG_KEY = "koch-sso:reload";

function memoryStorage(initial: Record<string, string> = {}) {
	const map = new Map(Object.entries(initial));
	return {
		getItem: (key: string) => map.get(key) ?? null,
		setItem: (key: string, value: string) => void map.set(key, value),
		removeItem: (key: string) => void map.delete(key),
	};
}

const blockedStorage = {
	getItem: () => {
		throw new Error("blocked");
	},
	setItem: () => {
		throw new Error("blocked");
	},
	removeItem: () => {
		throw new Error("blocked");
	},
};

describe("isNetworkFailure", () => {
	it("reconhece falha de rede do axios (sem resposta HTTP)", () => {
		const error = new AxiosError(
			"Network Error",
			AxiosError.ERR_NETWORK,
			config,
		);
		expect(isNetworkFailure(error)).toBe(true);
	});

	it("não confunde 401 com falha de rede", () => {
		const error = new AxiosError(
			"Unauthorized",
			AxiosError.ERR_BAD_REQUEST,
			config,
			null,
			{
				status: 401,
				statusText: "Unauthorized",
				data: {},
				headers: {},
				config,
			},
		);
		expect(isNetworkFailure(error)).toBe(false);
	});

	it("não trata timeout nem cancelamento como falha de rede", () => {
		expect(
			isNetworkFailure(
				new AxiosError("timeout", AxiosError.ECONNABORTED, config),
			),
		).toBe(false);
		expect(
			isNetworkFailure(
				new AxiosError("canceled", AxiosError.ERR_CANCELED, config),
			),
		).toBe(false);
	});

	// O axios não é importado em runtime: duas cópias do axios no bundle
	// quebrariam um `instanceof`, e app com fetch puro nem tem axios.
	it("reconhece erro do axios de outra instância (duck typing)", () => {
		expect(isNetworkFailure({ isAxiosError: true, code: "ERR_NETWORK" })).toBe(
			true,
		);
	});

	it.each([
		"Failed to fetch", // Chrome
		"NetworkError when attempting to fetch resource.", // Firefox
		"Load failed", // Safari
	])("reconhece falha de rede do fetch: TypeError %j", (message) => {
		expect(isNetworkFailure(new TypeError(message))).toBe(true);
	});

	// TypeError também nasce de bug de código; só a mensagem de rede conta.
	it("não trata qualquer TypeError como falha de rede", () => {
		expect(
			isNetworkFailure(new TypeError("Cannot read properties of undefined")),
		).toBe(false);
	});

	it("ignora erro que não é de rede", () => {
		expect(isNetworkFailure(new Error("x"))).toBe(false);
		expect(isNetworkFailure(new Error("Failed to fetch"))).toBe(false);
		expect(isNetworkFailure(undefined)).toBe(false);
		expect(isNetworkFailure(null)).toBe(false);
		expect(isNetworkFailure("ERR_NETWORK")).toBe(false);
	});
});

describe("reloadOnceForSso", () => {
	it("recarrega na primeira falha e marca que já recarregou", () => {
		const storage = memoryStorage();
		const reload = vi.fn();

		expect(reloadOnceForSso(storage, reload)).toBe(true);
		expect(reload).toHaveBeenCalledTimes(1);
		expect(storage.getItem(FLAG_KEY)).toBe("1");
	});

	it("não recarrega de novo se a página acabou de recarregar por isso", () => {
		const storage = memoryStorage({ [FLAG_KEY]: "1" });
		const reload = vi.fn();

		expect(reloadOnceForSso(storage, reload)).toBe(false);
		expect(reload).not.toHaveBeenCalled();
		// Rearma: a próxima falha (ex.: depois de a rede voltar) pode recarregar.
		expect(storage.getItem(FLAG_KEY)).toBeNull();
	});

	it("sem storage utilizável não recarrega (evita loop infinito)", () => {
		const reload = vi.fn();

		expect(reloadOnceForSso(blockedStorage, reload)).toBe(false);
		expect(reload).not.toHaveBeenCalled();
	});
});

describe("clearSsoReloadFlag", () => {
	it("limpa a marca quando a sessão carrega", () => {
		const storage = memoryStorage({ [FLAG_KEY]: "1" });
		clearSsoReloadFlag(storage);
		expect(storage.getItem(FLAG_KEY)).toBeNull();
	});

	it("engole storage bloqueado", () => {
		expect(() => clearSsoReloadFlag(blockedStorage)).not.toThrow();
	});
});
