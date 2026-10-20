import { loadConfig } from "./config.js";

const config = loadConfig("package.json");

console.log(config);