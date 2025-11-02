import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {Massifs} from "@database/models/Massifs";
import {MassifCache} from "@cache/MassifCache";
import {Subscriptions} from "@database/models/Subscriptions";

export namespace CommandUnsubscribe {

    function buildMassifMenu(mountain: string): Menu {
        const massifMenu = new Menu<Context>(`unsubscribe-massifs-${mountain}`);

        massifMenu.dynamic(async (ctx, range) => {
            if (!ctx.from?.id) return;

            // Fetch user's subscribed massifs
            const userMassifs = await Massifs.getAllForRecipient(ctx.from.id);
            const massifsInMountain = userMassifs.filter(m => m.mountain === mountain);

            for (const massif of massifsInMountain) {
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
        });

        massifMenu.back("← Back to mountains");

        return massifMenu;
    }

    function buildMountainMenu(): Menu {
        const mountainMenu = new Menu<Context>("unsubscribe-mountains");

        mountainMenu.dynamic(async (ctx, range) => {
            if (!ctx.from?.id) return;

            // Fetch user's subscribed massifs
            const userMassifs = await Massifs.getAllForRecipient(ctx.from.id);

            if (userMassifs.length === 0) return;

            // Group by mountain
            const mountainsWithSubs = [...new Set(userMassifs.map(m => m.mountain).filter(Boolean))].sort();

            for (const mountain of mountainsWithSubs) {
                range.submenu(mountain as string, `unsubscribe-massifs-${mountain}`).row();
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

        // Register all massif submenus for all mountains
        const mountains = MassifCache.getMountains();
        for (const mountain of mountains) {
            const massifMenu = buildMassifMenu(mountain);
            mountainMenu.register(massifMenu);
        }

        return mountainMenu;
    }

    function command(mountainMenu: Menu): (ctx: Context) => Promise<void> {
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

                await ctx.reply("Choose a mountain range to unsubscribe from", {reply_markup: mountainMenu});
            } catch (error) {
                console.error('Error in unsubscribe command:', error);
                await ctx.reply("An error occurred. Please try again.");
            }
        };
    }

    export async function attach(bot: Bot) {
        const menu = buildMountainMenu();
        bot.use(menu);
        bot.command("unsubscribe", command(menu));
    }
}

