import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {Subscriptions} from "@database/models/Subscriptions";
import {Massifs} from "@database/models/Massifs";
import {Bulletins} from "@database/models/Bulletins";
import {CommandGet} from "@bot/commands/get";

export namespace CommandSubscribe {

    // Cache for mountains data
    let mountainsCache: string[] = [];

    async function initializeCache() {
        mountainsCache = await Massifs.getDistinctMountains();
    }

    function buildMassifMenu(mountain: string): Menu {
        const massifMenu = new Menu<Context>(`subscribe-massifs-${mountain}`);

        massifMenu.dynamic(async (_ctx, range) => {
            const massifs = await Massifs.getByMountain(mountain);

            for (const massif of massifs) {
                range.text(massif.name, async (context) => {
                    const recipientId = context.from?.id as number;
                    const alreadySubscribed = await Subscriptions.isSubscribed(recipientId, massif.code);
                    if (alreadySubscribed) {
                        await context.reply(`You are already subscribed to ${massif.name}`);
                    } else {
                        await Subscriptions.subscribe(recipientId, massif);
                        await context.reply(`You are now subscribed to ${massif.name}`);
                        await CommandGet.send(context, massif);
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
            for (const mountain of mountainsCache) {
                range.submenu(mountain, `subscribe-massifs-${mountain}`).row();
            }
        });

        // Register all massif submenus
        for (const mountain of mountainsCache) {
            const massifMenu = buildMassifMenu(mountain);
            mountainMenu.register(massifMenu);
        }

        return mountainMenu;
    }

    function command(mountainMenu: Menu): (ctx: Context) => Promise<void> {
        return async (ctx: Context) => {
            await ctx.reply("Choose a mountain range", {reply_markup: mountainMenu});
        };
    }

    export async function attach(bot: Bot) {
        await initializeCache();
        const menu = buildMountainMenu();
        bot.use(menu);
        bot.command("subscribe", command(menu));
    }
}
