import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const t = fs.readFileSync(path.join(root, "shared", "inventoryCatalogueSeed.ts"), "utf8");
const items = [];
const re = /itemCode:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?category:\s*"([^"]+)"/g;
let m;
while ((m = re.exec(t))) {
  items.push({ itemCode: m[1], name: m[2], category: m[3] });
}
fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "manual-catalogue.json"), JSON.stringify(items, null, 2));
console.log("wrote", items.length, "items");
