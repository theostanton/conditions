import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {Massifs} from "../database/Massifs";
import {Bulletins} from "../database/Bulletins";


export namespace CommandGet {


    async function buildMenu(): Promise<Menu> {

        const massifs = await Massifs.getAll()
        const getMenu = new Menu("get");

        massifs.forEach(massif => {
            getMenu.text(massif.name, async context => {
                const bulletin = await Bulletins.getLatest(massif.code);

                if (bulletin === undefined) {
                    await context.reply(`No bulletin for ${massif.name}`);
                } else if (bulletin.valid_to < new Date()) {
                    await context.reply(`No valid bulletin for ${massif.name}`);
                } else {
                    await context.replyWithDocument(bulletin.public_url);
                }
            }).row();
        });

        return getMenu;
    }

    function commandGet(getMenu: Menu): (context: Context) => Promise<void> {
        return async (context: Context) => {
            await context.reply("Get the latest BRA", {reply_markup: getMenu});
        };
    }

    export async function attach(bot: Bot) {
        const menu = await buildMenu()
        bot.use(menu)
        bot.command("get", commandGet(menu));

    }


}