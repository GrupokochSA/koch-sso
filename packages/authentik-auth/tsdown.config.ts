import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		express: "src/adapters/express.ts",
		fastify: "src/adapters/fastify.ts",
		nest: "src/adapters/nest.ts",
		consinco: "src/consinco/index.ts",
	},
	format: ["esm", "cjs"],
	dts: true,
	clean: true,
	platform: "node",
	target: "node22",
});
