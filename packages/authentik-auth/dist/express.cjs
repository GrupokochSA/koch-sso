Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const require_request_auth = require("./request-auth-nHk91Bbj.cjs");
//#region src/adapters/express.ts
function authentikAuth(options) {
	return async (req, res, next) => {
		try {
			const outcome = await require_request_auth.authenticateRequest(req.headers, options);
			if (outcome.kind === "rejected") {
				res.status(401).json(outcome.body);
				return;
			}
			if (outcome.kind === "user") req.user = outcome.user;
			next();
		} catch (error) {
			next(error);
		}
	};
}
//#endregion
exports.authentikAuth = authentikAuth;
