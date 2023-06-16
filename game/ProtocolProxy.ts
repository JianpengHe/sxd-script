import { ISocketAggregationInfo, SocketAggregation } from "./SocketAggregation";
import { ProtocolParse } from "./ProtocolParse";
import { getModJson, readProtocolBuffer } from "../utils";

import * as net from "net";
import { Log } from "./Log";

const log = new Log();

export class ProtocolProxy {
  public readonly localSock: net.Socket;
  public readonly remoteSock: net.Socket;
  public readonly info: ISocketAggregationInfo;
  public readonly socketAggregation: SocketAggregation;
  constructor(info: ISocketAggregationInfo, localSock: net.Socket, socketAggregation: SocketAggregation) {
    this.localSock = localSock;
    this.remoteSock = net.connect(info);
    this.info = info;
    this.socketAggregation = socketAggregation;
    // this.remoteSock.pipe(this.localSock);
    // this.localSock.pipe(this.remoteSock);

    new ProtocolParse(this.localSock).onData(async ({ headBuffer, dataBuffer, buffer, modId, funId }) => {
      const { Mname, name, req } = await getModJson(modId, funId);
      const protocolData = readProtocolBuffer(buffer, req);
      console.log("↑", info.remark, "\t", modId, Mname, "\t", funId, name, protocolData);
      log.up(info.remark, protocolData, modId, funId);
      this.remoteSock.write(Buffer.concat([headBuffer, dataBuffer]));
    });

    new ProtocolParse(this.remoteSock).onData(async ({ headBuffer, dataBuffer, buffer, modId, funId }) => {
      const { Mname, name, res } = await getModJson(modId, funId);
      const protocolData = readProtocolBuffer(buffer, res);
      console.log("↓", info.remark, "\t", modId, Mname, "\t", funId, name);
      log.down(info.remark, protocolData, modId, funId);
      this.localSock.write(Buffer.concat([headBuffer, dataBuffer]));
    });
  }
}
