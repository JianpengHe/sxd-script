import { Town } from "./town";
const getParam = require(__dirname + "/../../sxd/getParam.js");

getParam().then(async param => {
  const town = new Town(param);
  setInterval(() => console.log(town.sock.listeners), 1000);
  await town.login;
  console.log("ok");
  console.log("登录成功", await town.getPlayerInfo());
});
