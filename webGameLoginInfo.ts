import * as http from "http";
import * as fs from "fs";
const request = (url: string, opt: http.RequestOptions = {}): Promise<{ headers: http.IncomingHttpHeaders; body: string }> =>
  new Promise(resolve =>
    http.get(url, opt, res => {
      const body: Buffer[] = [];
      res.on("data", chuck => body.push(chuck));
      res.on("end", () => resolve({ headers: res.headers, body: String(Buffer.concat(body)) }));
    })
  );

export const getWebGameReqBody = async (err = 0): Promise<string> => {
  if (err > 3) {
    throw new Error("失败次数过多");
  }

  let cookie = "";
  try {
    cookie = String(await fs.promises.readFile(".cookie"));
  } catch (e) {}

  const { body } = await request("http://s0.sxd.xd.com", { headers: { cookie } });

  if (body) {
    return body;
  }

  await login();
  return await getWebGameReqBody(err + 1);
};

export const getWebGameParam = async (reqBody?: string) => {
  const param: { [x: string]: string } = {};
  for (const [k, v] of new URLSearchParams(((((reqBody || (await getWebGameReqBody()) || "").match(/flashVars([^;]+);/i) || [])[1] || "").match(/(?<=").*?(?=")/g) || []).join("")).entries()) {
    param[k] = v;
  }
  return param;
};

const login = async () => {
  //TODO: 登录逻辑
  const { headers } = await request("");

  await fs.promises.writeFile(
    ".cookie",
    headers["set-cookie"]
      ?.map(cookie => cookie.substring(0, cookie.indexOf(";")) + "; ")
      .join("")
      .trim() || ""
  );
};
