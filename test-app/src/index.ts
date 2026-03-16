import { App } from "@ion/core";
import { http, type HttpOptions } from "@ion/http";
import { ws } from "@ion/ws";
import { pg, type PgOptions } from "@ion/pg-db";
import { env } from "./env.js";
import { jsxCompiler } from "@ion/jsx";
import { App as AppView } from "./views/app.js";

const app = new App();

const httpOptions: HttpOptions = {
	host: env.host,
	port: env.port,
};

const pgOptions: PgOptions = {
	host: env.db_host,
	port: env.db_port,
	user: env.db_user,
	password: env.db_password,
	database: env.db_database,
};

app.use(
	ws(),
	http(httpOptions),
	pg(pgOptions),
	// TODO: this should generate http routes and client bundles (jsx, html, css etc)
	jsxCompiler(AppView, "/"),
);

app.start().then(result => {
	if(result.isErr()) {
		console.error(result.error);
	}
});