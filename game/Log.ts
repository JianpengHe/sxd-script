import { IProtocolData, getModJson, logSavePath } from "../utils";

import * as fs from "fs";
import * as crypto from "crypto";

const MD5 = (str: string) => crypto.createHash("md5").update(str).digest("hex");

type ILog = {
  remark: string;
  modId: number;
  funId: number;
  reqTime: number;
  resTime: number;
  req: any[];
  res: any[];
};
export class Log {
  private pool: Map<number, Map<number, ILog[]>> = new Map();
  private logMap: Map<string, ILog> = new Map();
  /** 某目录下存了多少文件 */
  private dirFilesCount: Map<string, number> = new Map();
  /** 定时器 */
  private timer: number = 0;
  constructor() {
    this.save();
  }

  async save() {
    for (const [hex, log] of this.logMap) {
      const { modId, funId } = log;
      const { Mname, Mfn, name, fn } = await getModJson(modId, funId);
      const path = `${logSavePath}${modId}.${Mfn}/${funId}.${fn}/`;
      let fileCount = this.dirFilesCount.get(path);
      if (!fileCount) {
        try {
          fileCount = (await fs.promises.readdir(path)).length;
        } catch (e) {
          await fs.promises.mkdir(path, { recursive: true });
          fileCount = 0;
        }
      }
      if (fileCount > 20) {
        // TODO
      }

      /** 不记录空服务器名 */
      if (log.remark) {
        await fs.promises.writeFile(`${path}/${hex}.json`, JSON.stringify(log, null, 2));
      }

      this.dirFilesCount.set(path, fileCount + 1);
      this.logMap.delete(hex);
    }
    this.timer = Number(
      setTimeout(() => {
        this.save();
      }, 5000)
    );
  }
  getQueue(modId: number, funId: number) {
    let funPoolByMod = this.pool.get(modId);
    if (!funPoolByMod) {
      funPoolByMod = new Map();
      this.pool.set(modId, funPoolByMod);
    }
    let funQueue = funPoolByMod.get(funId);
    if (!funQueue) {
      funQueue = [];
      funPoolByMod.set(funId, funQueue);
    }
    return funQueue;
  }
  setLog(log: ILog) {
    const { reqTime, resTime, ...other } = log;
    this.logMap.set(MD5(JSON.stringify(other)), log);
  }
  up(remark: string, req: IProtocolData, modId: number, funId: number) {
    const queue = this.getQueue(modId, funId);
    queue.push({
      remark,
      modId,
      funId,
      reqTime: new Date().getTime(),
      resTime: 0,
      req,
      res: [],
    });
  }
  down(remark: string, res: IProtocolData, modId: number, funId: number) {
    const queue = this.getQueue(modId, funId);
    const resTime = new Date().getTime();
    let log: ILog | undefined;
    while ((log = queue.shift())) {
      if (log.reqTime + 10000 < resTime) {
        this.setLog(log);
        console.log("超时");
        continue;
      }
      log.resTime = resTime;
      log.res = res;
      this.setLog(log);
      return;
    }
    log = {
      remark,
      modId,
      funId,
      reqTime: 0,
      resTime,
      req: [],
      res,
    };
    this.setLog(log);
  }
}
