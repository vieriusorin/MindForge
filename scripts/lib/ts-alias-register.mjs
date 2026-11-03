// PT-0353: `node --import scripts/lib/ts-alias-register.mjs` — installs `ts-alias-loader.mjs`.
import { register } from "node:module";

register("./ts-alias-loader.mjs", import.meta.url);
