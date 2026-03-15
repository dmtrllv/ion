import { loadEnv } from "@ion/core";

export const env = loadEnv({
	host: "localhost",
	port: 80,
	db_host: "localhost",
	db_port: 5432,
	db_user: "postgres",
	db_password: "root",
	db_database: "ion-test-app",
});