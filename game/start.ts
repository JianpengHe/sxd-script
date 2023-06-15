import { downloadChrome } from "./downloadChrome";
import { getWebGameParam, getWebGameReqBody } from "../webGameLoginInfo.secret";
import { SocketAggregation } from "./SocketAggregation";

import * as fs from "fs";
import * as http from "http";
import * as net from "net";
import * as path from "path";
import * as child_process from "child_process";

const PATH = path.resolve(__dirname, "Chrome");
const PORT = 47670;

const hasFile = (path: string) =>
  new Promise(r =>
    fs.stat(path, (err, stat) => {
      r(Boolean(stat?.size));
    })
  );

(async () => {
  if (!(await hasFile(PATH + "/chrome.exe"))) {
    console.log("下载谷歌浏览器");
    await downloadChrome(PATH);
  }
  /** 启动谷歌浏览器 */
  child_process.exec(
    PATH +
      "/chrome.exe" +
      ` "http://127.0.0.1:${PORT}" ` +
      ['--ppapi-flash-path="pepflashplayer64_32_0_0_238.dll"', '--ppapi-flash-version="32.0.0.238"', "--allow-outdated-plugins", "--disable-web-security", `--user-data-dir="${PATH}/user_data"`].join(
        " "
      ),
    { cwd: PATH },
    () => {}
  );
  const socketAggregation = new SocketAggregation(PORT);
  socketAggregation.onConnect = (sock, info) => {
    if (info.port === 80) {
      httpServer.emit("connection", sock);
      return;
    }

    console.log("连接", info.host, info.port);
    // sock.on("data", a => console.log(a, a.length));
    const remoteSock = net.connect(info);
    remoteSock.pipe(sock);
    sock.pipe(remoteSock);
  };

  const httpServer = http.createServer(async (req, res) => {
    if (req.url === "/") {
      /** 获取页面 */
      let page = await getWebGameReqBody();
      const param = await getWebGameParam(page);

      socketAggregation.add(param.hash_code, { remark: "town", host: param.ip, port: Number(param.port) });

      /** 修改网页页面 */
      page = page.replace(/\(version/g, "(0&&version").replace(/iframe/g, "div");
      page = page.replace("&port=" + param.port, "&port=" + PORT).replace("&ip=" + param.ip, "&ip=127.0.0.1");
      page = page.replace(/deleted/g, "");

      res.end(page);
      return;
    }
    res.end("404");
  });
  //.listen(PORT);
})();
