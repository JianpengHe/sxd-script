import * as http from "http";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

const fileName = String(Buffer.from("TWFpbi5zd2Y=", "base64"));

/** swf存放的位置 */
const savePath = path.resolve(__dirname, "../sxd-protocols", fileName);

const get = (url: string): Promise<Buffer> =>
  new Promise(r =>
    http.get(url, res => {
      const body: Buffer[] = [];
      res.on("data", chuck => body.push(chuck));
      res.on("end", () => r(Buffer.concat(body)));
    })
  );

const SHA1 = (str: string) => crypto.createHash("sha1").update(str).digest();

export const updateMainSwf = async ({ client_url, diff_url, diff_urls, cur_ver }) => {
  const keyHash = SHA1("game/" + fileName).subarray(0, 5);
  let buffer = await get(`${diff_url}${cur_ver}..${cur_ver}-${JSON.parse(diff_urls)[cur_ver]}`);
  while (buffer.length >= 25) {
    if (keyHash.compare(buffer.subarray(0, 5)) === 0) {
      await fs.promises.writeFile(savePath, await get(`${client_url}file/${buffer.subarray(5, 25).toString("hex")}/${fileName}`));
      return;
    }
    buffer = buffer.subarray(25);
  }
};
