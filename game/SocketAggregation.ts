import { IDataPackage, formatDataBuffer, getHeadBuffer, getModJson, readProtocolBuffer } from "../utils";
import * as net from "net";

type ISocketAggregationInfo = { remark: string; port: number; host: string };
export class SocketAggregation {
  public reqPool: Map<string, ISocketAggregationInfo> = new Map();
  public onConnect: (sock: net.Socket, info: ISocketAggregationInfo) => void;
  private server: net.Server;
  private readonly firstPacket = async (sock: net.Socket) => {
    console.log("sock");
    const tempBuffer: Buffer[] = [];
    let tempBufferSize: number = 0;
    // let needBufferSize: number = 8;
    let dataPackage: IDataPackage | undefined;
    const cleanAndExit = (info: ISocketAggregationInfo, ...buffer: Buffer[]) => {
      sock.removeAllListeners("data");
      sock.unshift(Buffer.concat(tempBuffer));
      sock.unshift(Buffer.concat([...buffer]));
      return this.onConnect(sock, info);
    };
    sock.on("data", async chuck => {
      tempBuffer.push(chuck);
      tempBufferSize += chuck.length;
      /** 已下载的长度是否满足最低数据包要求 */
      while ((!dataPackage && tempBufferSize >= 8) || (dataPackage && tempBufferSize >= dataPackage.dataLen)) {
        if (tempBuffer.length > 1) {
          /** 整合buffer数组 */
          tempBuffer[0] = Buffer.concat(tempBuffer);
          tempBuffer.length = 1;
          tempBufferSize = tempBuffer[0].length;
        }
        const bufferLen = (dataPackage?.dataLen ?? 12) - 4;
        const buffer = tempBuffer[0].subarray(0, bufferLen);
        tempBuffer[0] = tempBuffer[0].subarray(bufferLen);

        tempBufferSize = tempBuffer[0].length;

        if (!dataPackage) {
          /** 处理数据包头部 */
          dataPackage = getHeadBuffer(buffer);

          // console.log(dataPackage);
          /** 判断是不是HTTP请求（GET请求） */
          if (dataPackage.dataLen === 0x47455420) {
            console.log("HTTP请求");
            cleanAndExit({ remark: "http", port: 80, host: "" }, buffer);
            return;
          } else if (dataPackage.dataLen === 0x3c706f6c) {
            sock.end(Buffer.from("PGNyb3NzLWRvbWFpbi1wb2xpY3k+PGFsbG93LWFjY2Vzcy1mcm9tIGRvbWFpbj0iKiIgdG8tcG9ydHM9IioiIC8+PC9jcm9zcy1kb21haW4tcG9saWN5PgA=", "base64"));
            return;
          }
        } else {
          /** 处理数据包body，获得完整dataPackage */
          await formatDataBuffer(dataPackage, buffer);

          const { headBuffer, dataBuffer, modId, funId } = dataPackage;
          /** 截获浏览器发送给服务器的登录信息 */
          for (const item of readProtocolBuffer(dataBuffer, (await getModJson(modId, funId)).req)) {
            let info: ISocketAggregationInfo | undefined;
            if (typeof item === "string" && (info = this.reqPool.get(item))) {
              console.log("路由成功", item);
              cleanAndExit(info, headBuffer, buffer);
              this.reqPool.delete(item);
              return;
            }
          }
          throw new Error("无法路由？");
        }
      }
    });
  };
  constructor(port: number) {
    this.onConnect = (sock, recvStream, ...a) => console.log(...a);
    this.server = net.createServer(this.firstPacket.bind(this));
    this.server.listen(port, "127.0.0.1");
  }
  public add(hash: string, info: ISocketAggregationInfo) {
    this.reqPool.set(hash, info);
    return this;
  }
}
