import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AuthentikIdentity } from "../authentik-jwt.js";
import {
	type AuthentikAuthOptions,
	authenticateRequest,
} from "../request-auth.js";

export type { AuthentikAuthOptions };

/** `req.user` depois do middleware. Sem augmentation global para não colidir
 * com o `Request.user` que o app (ou passport) já declara. */
export type AuthentikRequest = Request & { user: AuthentikIdentity };

export function authentikAuth(options: AuthentikAuthOptions): RequestHandler {
	return async (req: Request, res: Response, next: NextFunction) => {
		try {
			const outcome = await authenticateRequest(req.headers, options);
			if (outcome.kind === "rejected") {
				res.status(401).json(outcome.body);
				return;
			}
			if (outcome.kind === "user") {
				(req as AuthentikRequest).user = outcome.user;
			}
			next();
		} catch (error) {
			// Express 4 não captura rejeição de handler async.
			next(error);
		}
	};
}
