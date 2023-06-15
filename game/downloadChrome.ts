import { UnZip } from "../../tools/release/node/UnZip";
import * as fs from "fs";
import * as https from "https";
export const downloadChrome = (path: string) =>
  new Promise(resolve =>
    https.get(String(Buffer.from("aHR0cHM6Ly9jbG91ZC5hbmFuYXMuY2hhb3hpbmcuY29tL3ZpZXcvZmlsZXZpZXdEb3dubG9hZD9vYmplY3RJZD0zZTM1ZjEzNDQwNWFhZjk2OWVlMzIyZWM1NGI0MzVmYw==", "base64")), res =>
      new UnZip(res, path)
        .onFile(info => {
          info.fileRecvStream?.pipe(fs.createWriteStream(info.filePath));
          console.log("下载浏览器文件", info.fileName);
        })
        .onEnd((info, s) => {
          console.log("下载完成");
          resolve(void 0);
        })
    )
  );
