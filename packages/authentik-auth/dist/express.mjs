import { t as authenticateRequest } from "./request-auth-B-ldT3DQ.mjs";
//#region src/adapters/express.ts
function authentikAuth(options) {
	return async (req, res, next) => {
		try {
			const outcome = await authenticateRequest(req.headers, options);
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
export { authentikAuth };
