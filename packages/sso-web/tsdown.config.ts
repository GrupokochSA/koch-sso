import { defineConfig } from "tsdown";

export default defineConfig({
	entry: { index: "src/index.ts" },
	format: ["esm", "cjs"],
	dts: true,
	clean: true,
	// Roda no browser (e no vite.config.ts, que é Node): sem alvo de plataforma.
	platform: "neutral",
	target: "es2022",
});
