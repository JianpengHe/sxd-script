import { getModJson, readProtocolBuffer } from "../utils";
import { ProtocolParse } from "./ProtocolParse";

import * as net from "net";

export type ISocketAggregationInfo = { remark: string; port: number; host: string };
export class SocketAggregation {
  public reqPool: Map<string, ISocketAggregationInfo> = new Map();

  private onConnectCallback: (sock: net.Socket, info: ISocketAggregationInfo) => void = (sock, recvStream, ...a) => console.log(...a);
  public onConnect(onConnectCallback: SocketAggregation["onConnectCallback"]) {
    this.onConnectCallback = onConnectCallback;
  }
  private server: net.Server;

  constructor(port: number) {
    this.server = net.createServer(sock => {
      const protocolParse = new ProtocolParse(sock);

      /** 处理数据包头部 */
      protocolParse.onHead(({ dataLen }, buffer) => {
        /** 判断是不是HTTP请求（GET请求） */
        if (dataLen === 0x47455420) {
          console.log("HTTP请求");
          protocolParse.cleanAndExit(buffer);
          this.onConnectCallback(sock, { remark: "http", port: 80, host: "" });
          return;
        } else if (dataLen === 0x3c706f6c) {
          sock.end(Buffer.from("PGNyb3NzLWRvbWFpbi1wb2xpY3k+PGFsbG93LWFjY2Vzcy1mcm9tIGRvbWFpbj0iKiIgdG8tcG9ydHM9IioiIC8+PC9jcm9zcy1kb21haW4tcG9saWN5PgA=", "base64"));
          return;
        }
      });

      /** 处理数据包body，获得完整dataPackage */
      protocolParse.onData(async ({ headBuffer, dataBuffer, modId, funId }, buffer) => {
        console.log(modId, funId, headBuffer, dataBuffer);
        /** 截获浏览器发送给服务器的登录信息 */
        for (const item of readProtocolBuffer(dataBuffer, (await getModJson(modId, funId)).req)) {
          let info: ISocketAggregationInfo | undefined;
          if (typeof item === "string" && (info = this.reqPool.get(item))) {
            console.log("路由成功", item);
            protocolParse.cleanAndExit(headBuffer, buffer);
            this.onConnectCallback(sock, info);
            this.reqPool.delete(item);
            return;
          }
        }
        throw new Error("无法路由？");
      });
    });
    this.server.listen(port, "127.0.0.1");
  }
  public add(hash: string, info: ISocketAggregationInfo) {
    this.reqPool.set(hash, info);
    return this;
  }
}
