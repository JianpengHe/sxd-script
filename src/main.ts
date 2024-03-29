import * as net from "net";
import * as zlib from "zlib";
import { Buf } from "../../tools/release/node/Buf";
import { RecvStream } from "../../tools/release/node/RecvStream";
const type = ["Boolean", "Byte", "UByte", "Double", "Long", "Float", "Int", "Short", "String"];
export type IBoolean = boolean;
export type IByte = number;
export type IUByte = number;
export type IDouble = number;
export type ILong = number;
export type IFloat = number;
export type IInt = number;
export type IShort = number;
export type IString = string;

export const readProtocolBuffer = (buffer: Buffer, rules: any) => {
  const buf = new Buf(buffer);
  const readItem = rule => {
    if (Array.isArray(rule)) {
      return Array(buf.readUIntBE(2))
        .fill(0)
        .map(() => rule.map(readItem));
    }

    switch (type[rule]) {
      case "Boolean":
        return buf.readUIntBE(1) > 0;
      case "Byte":
        return buf.readIntBE(1);
      case "UByte":
        return buf.readUIntBE(1);
      case "Double":
        return buf.read(8).readDoubleBE();
      case "Long":
        return buf.readUIntBE(8);
      case "Float":
        return buf.read(4).readFloatBE();
      case "Int":
        return buf.readIntBE(4);
      case "Short":
        return buf.readIntBE(2);
      case "String":
        return buf.readString(buf.readIntBE(2));
      default:
        throw new Error("what read??");
    }
  };
  return rules.map(readItem);
};
export const writeProtocolBuffer = (data: any, rules: any) => {
  const buf = new Buf();
  const writeItem = (data, rule, b = true) => {
    if (Array.isArray(data)) {
      buf.writeUIntBE(data.length, 2);
      data.forEach((a, i) => writeItem(a, b ? rule : rule[i], false));
      return;
    }

    switch (type[rule]) {
      case "Boolean":
        return buf.writeIntBE(data ? 1 : 0, 1);
      case "Byte":
        return buf.writeIntBE(data, 1);
      case "UByte":
        return buf.writeUIntBE(data, 1);
      case "Double":
        return buf.write(
          (buffer => {
            buffer.writeDoubleBE(data);
            return buffer;
          })(Buffer.alloc(8))
        );
      case "Long":
        return buf.writeIntBE(data, 8);
      case "Float":
        return buf.write(
          (buffer => {
            buffer.writeFloatBE(data);
            return buffer;
          })(Buffer.alloc(4))
        );
      case "Int":
        return buf.writeIntBE(data, 4);
      case "Short":
        return buf.writeIntBE(data, 2);
      case "String":
        return buf.writeStringPrefix(data, len => {
          buf.writeIntBE(len, 2);
          return undefined;
        });
      default:
        console.log(data, rule);
        throw new Error("what write??");
    }
  };
  if (data.length !== rules.length) {
    console.log(data, rules);
    throw new Error("write len err");
  }
  data.forEach((a, i) => writeItem(a, rules[i]));
  return buf.buffer;
};

export type IDataPackage = {
  dataLen: number;
  modId: number;
  funId: number;
  dataBuffer: Buffer;
};

export const getHeadBuffer = (buffer: Buffer): IDataPackage => ({
  dataLen: buffer.readUInt32BE(),
  dataBuffer: Buffer.alloc(0),
  modId: buffer.readUInt16BE(4),
  funId: buffer.readUInt16BE(6),
});

export const formatDataBuffer = async (dataPackage: IDataPackage, buffer: Buffer) => {
  if (dataPackage.modId === 30876) {
    buffer = await new Promise(r =>
      zlib.inflateRaw(buffer, (err, d) => {
        if (err) {
          throw err;
        }
        r(d);
      })
    );
    dataPackage.modId = buffer.readUInt16BE();
    dataPackage.funId = buffer.readUInt16BE(2);
    buffer = buffer.subarray(4);
  }
  dataPackage.dataBuffer = buffer;
};

export class Connect {
  public readonly socket: net.Socket;
  private recvStream: RecvStream;
  // public readonly msgPool: Map<number, Buffer[]> = new Map();
  public readonly listeners: Map<number, (buffer: Buffer) => void> = new Map();
  public readonly getListenerKey = (modId: number, funId: number) => modId * 100000 + funId;
  public readonly request = async (modId: number, funId: number, reqRules: any, reqBody: any, resRules: any): Promise<any> => {
    const reqBuffer = new Buf();
    /** 先占位 */
    reqBuffer.writeUIntBE(0, 4);
    reqBuffer.writeUIntBE(modId, 2);
    reqBuffer.writeUIntBE(funId, 2);
    reqBuffer.write(writeProtocolBuffer(reqBody, reqRules));
    /** 重新计算长度 */
    reqBuffer.buffer.writeUInt32BE(reqBuffer.buffer.length - 8);

    const resBuffer: Buffer = await new Promise((resolve, reason) => {
      if (this.listeners.has(this.getListenerKey(modId, funId))) {
        reason(new Error("已存在" + modId + "," + funId));
        return;
      }
      this.listeners.set(this.getListenerKey(modId, funId), resolve);
      console.log(this.listeners);
      this.socket.write(reqBuffer.buffer);
    });
    return readProtocolBuffer(resBuffer, resRules);
  };

  private recv = () =>
    this.recvStream.readBuffer(8, buffer => {
      const dataPackage = getHeadBuffer(buffer);
      this.recvStream.readBuffer(dataPackage.dataLen, async buffer => {
        await formatDataBuffer(dataPackage, buffer);
        const { dataBuffer, modId, funId } = dataPackage;
        const callback = this.listeners.get(this.getListenerKey(modId, funId));
        if (!callback) {
          console.log("未注册监听器", modId, funId);
        } else {
          callback(dataBuffer);
          this.listeners.delete(this.getListenerKey(modId, funId));
        }
        this.recv();
      });
    });

  constructor(host: string, port: number) {
    this.socket = net.connect({ host, port });
    this.recvStream = new RecvStream(this.socket);
    this.recv();
  }
}
