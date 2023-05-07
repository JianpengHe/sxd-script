import { Connect } from "./main";
import { Player } from "./protocols/Player";

// export const login
export class Town {
  public readonly sock: Connect;
  public readonly login: Promise<Player.login["res"]>;
  constructor(param) {
    this.sock = new Connect(param.ip, param.port);
    this.login = (async sock => {
      const out = await Player.login(sock, param.player_name, param.hash_code, param.time, param.source, param.regdate | 0, param.id_card, parseInt(param.open_time), param.is_newst | 0, param.stage, param.client, param.non_kid | 0, param.old_user);
      if (!out || out[0]) {
        throw new Error("登录失败");
      }
      console.log("成功");
      return out;
    })(this.sock);
  }
  async getPlayerInfo() {
    const data = await Player.get_player_info(this.sock);
    const out = {
      /** 玩家姓名 */
      playerName: data[0],
      /** 玩家等级 */
      playerLevel: data[1],
      /** 元宝数 */
      YB: data[2],
      /** 铜钱 */
      TQ: data[3],
      /** 体力 */
      power: data[6] + data[23],
    };
    return out;
  }
}
