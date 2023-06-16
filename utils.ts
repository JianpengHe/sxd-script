import * as zlib from "zlib";
import * as fs from "fs";
import { Buf } from "../tools/release/node/Buf";

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
  /** 原始头部 */
  headBuffer: Buffer;
  /** 原始数据 */
  dataBuffer: Buffer;
  /** 解压后的数据 */
  buffer: Buffer;
};

export const getHeadBuffer = (buffer: Buffer): IDataPackage => ({
  dataLen: buffer.readUInt32BE(),
  headBuffer: buffer,
  dataBuffer: Buffer.alloc(0),
  buffer: Buffer.alloc(0),
  modId: buffer.readUInt16BE(4),
  funId: buffer.readUInt16BE(6),
});

export const formatDataBuffer = async (dataPackage: IDataPackage, buffer: Buffer) => {
  dataPackage.dataBuffer = buffer;
  if (dataPackage.modId === 30876) {
    buffer = Buffer.concat([dataPackage.headBuffer.subarray(6), buffer]);
    // console.log(dataPackage, buffer);
    buffer = zlib.inflateRawSync(buffer);
    /** 未解之谜 */
    // const bufCopy = Buffer.allocUnsafe(buffer.length);
    // buffer.copy(bufCopy);
    // buffer = await new Promise(r =>
    //   zlib.inflateRaw(bufCopy, (err, d) => {
    //     if (err) {
    //       console.log(err);
    //       r(Buffer.alloc(0));
    //       //throw err;
    //     }
    //     r(d);
    //   })
    // );
    // console.log(buffer, dataPackage);
    if (buffer.length >= 4) {
      dataPackage.modId = buffer.readUInt16BE();
      dataPackage.funId = buffer.readUInt16BE(2);
      buffer = buffer.subarray(4);
    } else {
      console.log("????", buffer);
      dataPackage.modId = -1;
      dataPackage.funId = -1;
      buffer = Buffer.alloc(0);
    }
  }
  dataPackage.buffer = buffer;
};

let Mod_json = {};
export const getModJson = async (modId: number, funId: number): Promise<{ Mname: string; Mfn: string; name: string; fn: string; req: any; res: any }> => {
  if (!("M0" in Mod_json)) {
    Mod_json = JSON.parse(String(await fs.promises.readFile(__dirname + "/../sxd-protocols/Mod.json")));
  }
  const M = Mod_json["M" + modId];
  const F = M["F" + funId];
  return {
    Mname: M.name,
    Mfn: M.fn,
    ...F,
  };
};
