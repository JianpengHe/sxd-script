import { logSavePath } from "./utils";

import * as fs from "fs";
import * as child_process from "child_process";

const resolve_PacketSamples_merge_conflict = async () => {
  const files =
    String(await new Promise(r => child_process.exec("git status", { cwd: logSavePath }, (err, stdout) => r(stdout))))
      .replace(/[ \t]/g, "")
      .match(/(?<=^both(modified|added):)[^\n]+$/gm) || [];
  if (!files.length) {
    return;
  }
  for (const file of files) {
    console.log("正在处理", file);
    await fs.promises.writeFile(
      logSavePath + file,
      JSON.stringify(
        JSON.parse(
          String(await fs.promises.readFile(logSavePath + file))
            .replace(/\s/g, "")
            .replace(/<<<<<<<HEAD(.*?)=======(.*?)>>>>>>>[a-f\d]{40}/m, (_, d1, d2) => (d1 > d2 ? d1 : d2))
        ),
        null,
        2
      )
    );
    await new Promise(r => child_process.exec(`git add "${file}"`, { cwd: logSavePath }, (err, stdout) => r(stdout)));
  }
  //await Promise.all(files.map(file => new Promise(r => child_process.exec(`git add "${file}"`, { cwd: logSavePath }, (err, stdout) => r(stdout)))));
  await resolve_PacketSamples_merge_conflict();
};

resolve_PacketSamples_merge_conflict();
