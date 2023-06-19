import { IFunKey, IProtocolData, getFunKey, improveTranslation, readModJson, saveModJson, writeProtocolBuffer } from "../utils";

import * as readline from "readline";
import * as net from "net";

const readlineData = (rl: readline.Interface): Promise<string[]> => new Promise(r => rl.question("", answer => r(answer.split(/\s+/))));

export class Readline {
  private funConn: Map<IFunKey, net.Socket>;
  private readonly rl: readline.Interface;
  public onCustomData = (onCustomDataCallBack: Readline["onCustomDataCallBack"]) => {
    this.onCustomDataCallBack = onCustomDataCallBack;
    return this;
  };
  private onCustomDataCallBack: (remark: string, req: IProtocolData, modId: number, funId: number) => void = () => {};

  public onFilterMod = (onFilterModCallBack: Readline["onFilterModCallBack"]) => {
    this.onFilterModCallBack = onFilterModCallBack;
    return this;
  };
  private onFilterModCallBack: (modId: number) => void = () => {};

  constructor(funConn: Readline["funConn"], input = process.stdin, output = process.stdout) {
    this.funConn = funConn;
    this.rl = readline.createInterface({ input, output });
    this.readline();
  }

  private cyclicActionTimer: number = 0;
  private cyclicAction(onCustomDataCallBackParameters: Parameters<Readline["onCustomDataCallBack"]>, buf: Buffer, sock: net.Socket, times = 1, interval = 1000) {
    console.log("剩余" + times + "次，按回车立刻终止");
    this.onCustomDataCallBack(...onCustomDataCallBackParameters);
    sock.write(buf);
    times--;
    if (times) {
      this.cyclicActionTimer = Number(setTimeout(() => this.cyclicAction(onCustomDataCallBackParameters, buf, sock, times, interval), interval));
    }
  }

  private async readline() {
    while (1) {
      let [modId, funId, arr, times] = await readlineData(this.rl);

      if (!modId) {
        console.log("操作终止");
        this.onFilterModCallBack(-1);
        clearTimeout(this.cyclicActionTimer);
        continue;
      }

      if (!/^\d+$/.test(modId)) {
        console.log("modId必须是数字!");
        continue;
      }
      const M = await readModJson(Number(modId));

      if (!funId) {
        /** 只显示某modId的记录 */
        this.onFilterModCallBack(Number(modId));
        console.log("只显示", modId, M.name, M.fn, "的记录，按回车退出");
        continue;
      }

      if (!/^\d+$/.test(funId)) {
        /** funId不是数字 */

        /** 翻译成XXX */
        const translateText = funId;

        console.log("已修改modId", modId, M.fn, M.name, "的翻译为", translateText);
        M.name = translateText;
        await Promise.all([improveTranslation(M.fn, translateText), saveModJson()]);
        continue;
      }

      const F = M["F" + funId];
      let protocolData: IProtocolData;

      try {
        /** 尝试解析 */
        protocolData = JSON.parse(arr || "[]");
      } catch (e) {
        /** arr不是数组 */

        /** 翻译成XXX */
        const translateText = arr;

        console.log("已修改modId", modId, M.fn, M.name, "funId", funId, F.fn, F.name, "的翻译为", translateText);
        F.name = translateText;
        await Promise.all([improveTranslation(F.fn, translateText), saveModJson()]);
        continue;
      }

      const onCustomDataCallBackParameters: Parameters<Readline["onCustomDataCallBack"]> = ["", protocolData, Number(modId), Number(funId)];

      /** 即将请求的buffer */
      const reqBuf = writeProtocolBuffer(protocolData, F.req, Number(modId), Number(funId));
      const sock = this.funConn.get(getFunKey(Number(modId), Number(funId)));

      if (!sock) {
        console.log("没找到modId", modId, M.fn, M.name, "funId", funId, F.fn, F.name, "对应的sock");
        continue;
      }
      this.cyclicAction(onCustomDataCallBackParameters, reqBuf, sock, Number(times) || 1, 1000);
    }
  }
}
