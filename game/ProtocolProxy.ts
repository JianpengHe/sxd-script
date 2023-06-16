import { ISocketAggregationInfo, SocketAggregation } from "./SocketAggregation";
import { ProtocolParse } from "./ProtocolParse";

import * as net from "net";

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
    new ProtocolParse(this.localSock).onData(async ({ headBuffer, dataBuffer, modId, funId }) => {
      console.log("↑", modId, funId);
      this.remoteSock.write(Buffer.concat([headBuffer, dataBuffer]));
    });
    new ProtocolParse(this.remoteSock).onData(async ({ headBuffer, dataBuffer, modId, funId }) => {
      console.log("↓", modId, funId);
      this.localSock.write(Buffer.concat([headBuffer, dataBuffer]));
    });
  }
}
