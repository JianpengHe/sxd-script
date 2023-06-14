const fs = require("fs");
const Mod = JSON.parse(String(fs.readFileSync(`${__dirname}/../sxd-protocols/Mod.json`)));
const type = ["Boolean", "Byte", "UByte", "Double", "Long", "Float", "Int", "Short", "String"];
const buildIProtocols = item => (Array.isArray(item) ? item.map(buildIProtocols) : "I" + type[item]);

for (const k in Mod) {
  const mid = Number(k.substring(1));
  const { name: m_name, fn: m_fn, ...f_obj } = Mod[k];
  const output = [];
  for (const f in f_obj) {
    /** 必须要F开头 */
    if (f[0] !== "F") {
      continue;
    }
    const fid = Number(f.substring(1));
    const { name: f_name, fn: f_fn, req, res } = f_obj[f];
    output.push(`/*` + `* ${f_name} *` + "/");
    output.push(`export const ${f_fn} = (connect: Connect, ...req: ${f_fn}["req"]): Promise<${f_fn}["res"]> => connect.request(${f_fn}.modId, ${f_fn}.funId, ${f_fn}.reqRules, req, ${f_fn}.resRules);`);
    output.push(`${f_fn}.modId = ${mid};`);
    output.push(`${f_fn}.funId = ${fid};`);
    output.push(`${f_fn}.reqRules = ${JSON.stringify(req)};`);
    output.push(`${f_fn}.resRules = ${JSON.stringify(res)};`);

    output.push(`export interface ${f_fn} {`);
    output.push(
      `req: ${JSON.stringify(buildIProtocols(req))
        .replace(/"/g, "")
        .replace(/\](?=.+)/g, "][]")};`
    );
    output.push(
      `res: ${JSON.stringify(buildIProtocols(res))
        .replace(/"/g, "")
        .replace(/\](?=.+)/g, "][]")};`
    );
    output.push(`}`);
    output.push(``);
  }
  fs.writeFileSync(`${__dirname}/src/protocols/${m_fn}.ts`, `import { Connect, IBoolean, IByte, IUByte, IDouble, ILong, IFloat, IInt, IShort, IString } from "../main";\n/*` + `* ${m_name} */\nexport namespace ${m_fn} {\n${output.join("\n")}}`);
}
