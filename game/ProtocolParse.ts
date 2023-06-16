import { IDataPackage, formatDataBuffer, getHeadBuffer } from "../utils";

import * as net from "net";

export class ProtocolParse {
  private onHeadCallback: (dataPackage: IDataPackage, buffer: Buffer) => void = () => {};
  public onHead(onHeadCallback: ProtocolParse["onHeadCallback"]) {
    this.onHeadCallback = onHeadCallback;
  }

  private onDataCallback: (dataPackage: IDataPackage, buffer: Buffer) => Promise<void> = async () => {};
  public onData(onDataCallback: ProtocolParse["onDataCallback"]) {
    this.onDataCallback = onDataCallback;
  }
  private sock: net.Socket;
  private tempBuffer: Buffer[] = [];
  private tempBufferSize: number = 0;

  public cleanAndExit(...buffers: Buffer[]) {
    this.sock.removeAllListeners("data");
    this.sock.unshift(Buffer.concat(this.tempBuffer));
    this.sock.unshift(Buffer.concat(buffers));
    this.tempBuffer.length = 0;
  }

  constructor(sock: net.Socket) {
    this.sock = sock;
    let dataPackage: IDataPackage | undefined;
    sock.on("data", async chuck => {
      this.tempBuffer.push(chuck);
      this.tempBufferSize += chuck.length;
      /** 已下载的长度是否满足最低数据包要求 */
      while (this.tempBuffer.length && ((!dataPackage && this.tempBufferSize >= 8) || (dataPackage && this.tempBufferSize >= dataPackage.dataLen - 4))) {
        if (this.tempBuffer.length > 1) {
          /** 整合buffer数组 */
          this.tempBuffer[0] = Buffer.concat(this.tempBuffer);
          this.tempBuffer.length = 1;
          this.tempBufferSize = this.tempBuffer[0].length;
        }
        const bufferLen = (dataPackage?.dataLen ?? 12) - 4;
        // console.log("bufferLen", bufferLen);
        const buffer = this.tempBuffer[0].subarray(0, bufferLen);
        this.tempBuffer[0] = this.tempBuffer[0].subarray(bufferLen);
        this.tempBufferSize = this.tempBuffer[0].length;

        if (!dataPackage) {
          /** 处理数据包头部 */
          dataPackage = getHeadBuffer(buffer);
          this.onHeadCallback(dataPackage, buffer);
        } else {
          /** 处理数据包body，获得完整dataPackage */
          await formatDataBuffer(dataPackage, buffer);
          await this.onDataCallback(dataPackage, buffer);
          dataPackage = undefined;
        }
      }
    });
  }
}
