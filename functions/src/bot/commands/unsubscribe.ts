import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {Massifs} from "@database/models/Massifs";
import {Subscriptions} from "@database/models/Subscriptions";

export namespace CommandUnsubscribe {

    function buildMenu(): Menu {
        const menu = new Menu<Context>("unsubscribe-menu");

        menu.dynamic(async (ctx, range) => {
            if (!ctx.from?.id) return;

            // Fetch user's subscribed massifs
            const userMassifs = await Massifs.getAllForRecipient(ctx.from.id);

            if (userMassifs.length === 0) return;

            // Show all massifs
            for (const massif of userMassifs) {
                range.text(massif.name, async (context) => {
                    try {
                        if (!context.from?.id) {
                            await context.reply("Unable to identify user");
                            return;
                        }

                        await Subscriptions.unsubscribe(context.from.id, massif);
                        await context.reply(`You are now unsubscribed from ${massif.name}`);
                    } catch (error) {
                        console.error('Error unsubscribing:', error);
                        await context.reply(`Failed to unsubscribe from ${massif.name}. Please try again.`);
                    }
                }).row();
            }

            // Add "Unsubscribe from all" option
            range.text("🗑️ Unsubscribe from all", async (context) => {
                try {
                    if (!context.from?.id) {
                        await context.reply("Unable to identify user");
                        return;
                    }

                    await Subscriptions.unsubscribeAll(context.from.id);
                    await context.reply("Unsubscribed from all BRAs");
                } catch (error) {
                    console.error('Error unsubscribing from all:', error);
                    await context.reply("Failed to unsubscribe. Please try again.");
                }
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

