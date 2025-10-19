import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {Subscriptions} from "@database/models/Subscriptions";
import {Massifs} from "@database/models/Massifs";

export namespace CommandSubscribe {

    async function buildMenu(): Promise<Menu> {
        const massifs = await Massifs.getAll()
        const subscribeMenu = new Menu<Context>("subscribe");

        massifs.forEach(massif => {
            subscribeMenu.text(massif.name, async context => {
                const recipientId = context.from?.id as number
                const alreadySubscribed = await Subscriptions.isSubscribed(recipientId, massif.code)
                if (alreadySubscribed) {
                    await context.reply(`You are already subscribed to ${massif.name}`);
                } else {
                    await Subscriptions.subscribe(recipientId, massif);
                    await context.reply(`You are now subscribed to ${massif.name}`);
                }
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
        bot.command("subscribe", command(menu))
    }
}
