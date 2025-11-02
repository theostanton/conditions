import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {Massifs} from "@database/models/Massifs";
import {ActionSubscriptions} from "@bot/actions/subscriptions";

export namespace CommandUnsubscribe {

    function buildMenu(): Menu {
        const menu = new Menu<Context>("unsubscribe-menu");

        menu.dynamic(async (ctx, range) => {
            if (!ctx.from?.id) return;

            const userMassifs = await Massifs.getAllForRecipient(ctx.from.id);

            if (userMassifs.length === 0) return;

            for (const massif of userMassifs) {
                range.text(massif.name, async (context) => {
                    await ActionSubscriptions.unsubscribe(context, massif);
                }).row();
            }

            range.text("🗑️ Unsubscribe from all", async (context) => {
                await ActionSubscriptions.unsubscribeAll(context);
            }).row();
        });

        return menu;
    }

    function command(menu: Menu): (ctx: Context) => Promise<void> {
        return async (ctx: Context) => {
            try {
                if (!ctx.from?.id) {
                    await ctx.reply("Unable to identify user");
                    return;
                }

                const userMassifs = await Massifs.getAllForRecipient(ctx.from.id);

                if (userMassifs.length === 0) {
                    await ctx.reply("You are not subscribed to any BRAs");
                    return;
                }

                await ctx.reply("Choose a massif to unsubscribe from", {reply_markup: menu});
            } catch (error) {
                console.error('Error in unsubscribe command:', error);
                await ctx.reply("An error occurred. Please try again.");
            }
        };
    }

    export async function attach(bot: Bot) {
        const menu = buildMenu();
        bot.use(menu);
        bot.command("unsubscribe", command(menu));
    }
}

