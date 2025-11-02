import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {Subscriptions} from "@database/models/Subscriptions";
import {MassifCache} from "@cache/MassifCache";
import {CommandGet} from "@bot/commands/get";

export namespace CommandSubscribe {

    function buildMassifMenu(mountain: string): Menu {
        const massifMenu = new Menu<Context>(`subscribe-massifs-${mountain}`);

        massifMenu.dynamic((_ctx, range) => {
            // Use cached data - no DB query!
            const massifs = MassifCache.getByMountain(mountain);

            for (const massif of massifs) {
                range.text(massif.name, async (context) => {
                    try {
                        if (!context.from?.id) {
                            await context.reply("Unable to identify user");
                            return;
                        }

                        const recipientId = context.from.id;
                        const alreadySubscribed = await Subscriptions.isSubscribed(recipientId, massif.code);

                        if (alreadySubscribed) {
                            await context.reply(`You are already subscribed to ${massif.name}`);
                        } else {
                            await Subscriptions.subscribe(recipientId, massif);
                            await context.reply(`You are now subscribed to ${massif.name}`);
                            await CommandGet.send(context, massif);
                        }
                    } catch (error) {
                        console.error('Error subscribing:', error);
                        await context.reply(`Failed to subscribe to ${massif.name}. Please try again.`);
                    }
                }).row();
            }
        });

        massifMenu.back("← Back to mountains");

        return massifMenu;
    }

    function buildMountainMenu(): Menu {
        const mountainMenu = new Menu<Context>("subscribe-mountains");

        mountainMenu.dynamic((_ctx, range) => {
            // Use cached data - no DB query!
            const mountains = MassifCache.getMountains();
            for (const mountain of mountains) {
                range.submenu(mountain, `subscribe-massifs-${mountain}`).row();
            }
        });

        // Register all massif submenus
        const mountains = MassifCache.getMountains();
        for (const mountain of mountains) {
            const massifMenu = buildMassifMenu(mountain);
            mountainMenu.register(massifMenu);
        }

        return mountainMenu;
    }

    function command(mountainMenu: Menu): (ctx: Context) => Promise<void> {
        return async (ctx: Context) => {
            if (!ctx.from?.id) {
                await ctx.reply("Unable to identify user");
                return;
            }
            await ctx.reply("Choose a mountain range", {reply_markup: mountainMenu});
        };
    }

    export async function attach(bot: Bot) {
        const menu = buildMountainMenu();
        bot.use(menu);
        bot.command("subscribe", command(menu));
    }
}
