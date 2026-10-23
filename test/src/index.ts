import { macroTest } from "test-lib";

const TestClass = macroTest("123");

const test = new TestClass();

console.log(test);