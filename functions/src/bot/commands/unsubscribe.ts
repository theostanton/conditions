import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {Massifs} from "@database/models/Massifs";
import {MassifCache} from "@cache/MassifCache";
import {Massif} from "@app-types";
import {Subscriptions} from "@database/models/Subscriptions";

export namespace CommandUnsubscribe {

    function buildMassifMenu(mountain: string, userMassifs: Massif[]): Menu {
        const massifMenu = new Menu<Context>(`unsubscribe-massifs-${mountain}`);

        const massifsInMountain = userMassifs.filter(m => m.mountain === mountain);

        for (const massif of massifsInMountain) {
            massifMenu.text(massif.name, async (context) => {
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

        massifMenu.back("← Back to mountains");

        return massifMenu;
    }

    async function buildMountainMenu(userId: number): Promise<Menu> {
        const mountainMenu = new Menu<Context>("unsubscribe-mountains");

        // Fetch user's subscribed massifs
        const userMassifs = await Massifs.getAllForRecipient(userId);

        if (userMassifs.length === 0) {
            // Empty menu - will be handled by command
            return mountainMenu;
        }

        // Group by mountain
        const mountainsWithSubs = [...new Set(userMassifs.map(m => m.mountain).filter(Boolean))].sort();

        for (const mountain of mountainsWithSubs) {
            const massifMenu = buildMassifMenu(mountain as string, userMassifs);
            mountainMenu.submenu(mountain as string, `unsubscribe-massifs-${mountain}`).row();
            mountainMenu.register(massifMenu);
        }

        // Add "Unsubscribe from all" option
        mountainMenu.text("🗑️ Unsubscribe from all", async (ctx) => {
            try {
                if (!ctx.from?.id) {
                    await ctx.reply("Unable to identify user");
                    return;
                }

                await Subscriptions.unsubscribeAll(ctx.from.id);
                await ctx.reply("Unsubscribed from all BRAs");
            } catch (error) {
                console.error('Error unsubscribing from all:', error);
                await ctx.reply("Failed to unsubscribe. Please try again.");
            }
        }).row();

        return mountainMenu;
    }

    function commandUnsubscribe(): (ctx: Context) => Promise<void> {
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

                const menu = await buildMountainMenu(ctx.from.id);
                await ctx.reply("Choose a mountain range to unsubscribe from", {reply_markup: menu});
            } catch (error) {
                console.error('Error in unsubscribe command:', error);
                await ctx.reply("An error occurred. Please try again.");
            }
        };
    }

    export async function attach(bot: Bot) {
        bot.command("unsubscribe", async (ctx) => {
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

                // Build and register menu dynamically for this user
                const menu = await buildMountainMenu(ctx.from.id);
                bot.use(menu);

                await ctx.reply("Choose a mountain range to unsubscribe from", {reply_markup: menu});
            } catch (error) {
                console.error('Error in unsubscribe command:', error);
                await ctx.reply("An error occurred. Please try again.");
            }
        });
    }
}

