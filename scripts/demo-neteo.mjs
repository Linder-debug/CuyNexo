import { readFileSync } from "node:fs";
import { calculateNetting } from "../dist/netting.js";

const fixture = new URL("../fixtures/cuatro-empresas.json", import.meta.url);
const result = calculateNetting(JSON.parse(readFileSync(fixture, "utf8")));
console.log(JSON.stringify(result, null, 2));
