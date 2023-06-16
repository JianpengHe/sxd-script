import { ISocketAggregationInfo, SocketAggregation } from "./SocketAggregation";
import { ProtocolParse } from "./ProtocolParse";
import { getModJson, readProtocolBuffer, writeProtocolBuffer } from "../utils";

import * as net from "net";
import { Log } from "./Log";

const log = new Log();

/** 自动找到服务器，自动走代理 */
const isAutoProxyServer = true;

/** 服务器列表 */
const Servers: ProtocolProxy[] = [];

const consoleLogColor = (protocolProxy: ProtocolProxy, isUp: boolean) => `${isUp ? `\x1B[41m↑\x1B[0m` : "↓"} \x1B[${32 + ((protocolProxy.serverId + 5) % 6)}m${protocolProxy.info.remark}\x1B[0m`;

export class ProtocolProxy {
  public readonly localSock: net.Socket;
  public readonly remoteSock: net.Socket;
  public readonly info: ISocketAggregationInfo;
  public readonly socketAggregation: SocketAggregation;
  public readonly PORT: number;
  public readonly serverId: number;
  constructor(info: ISocketAggregationInfo, localSock: net.Socket, socketAggregation: SocketAggregation, PORT: number) {
    this.localSock = localSock;
    this.remoteSock = net.connect(info);
    this.info = info;
    this.socketAggregation = socketAggregation;
    this.PORT = PORT;
    this.serverId = Servers.length;
    Servers.push(this);
    // this.remoteSock.pipe(this.localSock);
    // this.localSock.pipe(this.remoteSock);

    new ProtocolParse(this.localSock).onData(async ({ headBuffer, dataBuffer, buffer, modId, funId }) => {
      const { Mname, name, req } = await getModJson(modId, funId);
      const protocolData = readProtocolBuffer(buffer, req);
      console.log(consoleLogColor(this, true), "\t", modId, Mname, "\t", funId, name, protocolData);
      log.up(info.remark, protocolData, modId, funId);
      this.remoteSock.write(Buffer.concat([headBuffer, dataBuffer]));
    });

    new ProtocolParse(this.remoteSock).onData(async ({ headBuffer, dataBuffer, buffer, modId, funId }) => {
      const { Mname, Mfn, name, res } = await getModJson(modId, funId);
      const protocolData = readProtocolBuffer(buffer, res);
      console.log(consoleLogColor(this, false), "\t", modId, Mname, "\t", funId, name);
      log.down(info.remark, protocolData, modId, funId);

      if (isAutoProxyServer) {
        /** 有可能的服务器域名 */
        let host = "";
        /** 有可能的服务器端口 */
        let port = 0;
        /** 有可能的服务器验证hash */
        let hash = "";

        for (let index = 0; index < protocolData.length; index++) {
          const str = protocolData[index];
          if (typeof str === "string") {
            if (/^[a-f\d]{32}$/i.test(str)) {
              hash = str;
              continue;
            }
            if (/^[\dx]+\.sxdweb\.xd\.com$/i.test(str)) {
              host = str;
              protocolData[index] = "127.0.0.1";
              /** 在域名附近找端口 */
              if (Number(protocolData[index + 1]) > 8000) {
                port = Number(protocolData[index + 1]);
                /** 修改数据包中的端口 */
                protocolData[index + 1] = typeof protocolData[index + 1] === "number" ? Number(this.PORT) : String(this.PORT);
              } else if (Number(protocolData[index - 1]) > 8000) {
                port = Number(protocolData[index - 1]);
                /** 修改数据包中的端口 */
                protocolData[index - 1] = typeof protocolData[index - 1] === "number" ? Number(this.PORT) : String(this.PORT);
              }
            }
          }
        }

        if (host && port && hash) {
          console.log("找到新服务器", Mfn, host, port);
          this.socketAggregation.add(hash, { host, port, remark: Mfn });
          const newDataBuffer = writeProtocolBuffer(protocolData, res);
          const newHeadBuffer = Buffer.alloc(8);
          /** dataLen */
          newHeadBuffer.writeUInt32BE(newDataBuffer.length + 4);
          /** modId */
          newHeadBuffer.writeUInt16BE(modId, 4);
          /** funId */
          newHeadBuffer.writeUInt16BE(funId, 6);

          this.localSock.write(Buffer.concat([newHeadBuffer, newDataBuffer]));
          return;
        }
      }
      this.localSock.write(Buffer.concat([headBuffer, dataBuffer]));
    });
  }
}
