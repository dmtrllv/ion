import { resolve } from "path";
import { spawn } from "child_process";

const libs = [
	"core",
	"db",
	"http",
	"jsx",
	"pg-db",
	"utils",
	"ws",
	"test-app",
];

const watch = (dir) => {
	dir = resolve(process.cwd(), dir);
	spawn("npm", ["run", "watch"], { cwd: dir, stdio: 'inherit', shell: true });
};

libs.forEach(lib => watch(lib));