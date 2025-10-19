import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {Subscriptions} from "../database/Subscriptions";
import {Massifs} from "../database/Massifs";

export namespace CommandSubscribe {

    async function buildMenu(): Promise<Menu> {
        const massifs = await Massifs.getAll()
        const subscribeMenu = new Menu<Context>("subscribe");

        massifs.forEach(massif => {
            subscribeMenu.text(massif.name, async context => {
                await Subscriptions.subscribe(context.from?.id as number, massif);
                await context.reply(`You are now subscribed to ${massif.name}`);
            }).row();
        });

        return subscribeMenu;
    }


    function command(subscribeMenu: Menu): (ctx: Context) => Promise<void> {
        return async (ctx: Context) => {
            await ctx.reply("Subscribe to BRAs", {reply_markup: subscribeMenu});
        };
    }

    export async function attach(bot: Bot) {
        const menu = await buildMenu()
        bot.use(menu)
        bot.command("unsubscribe", command(menu))
    }
}
