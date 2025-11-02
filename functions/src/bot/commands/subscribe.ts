import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {MassifCache} from "@cache/MassifCache";
import {ActionSubscriptions} from "@bot/actions/subscriptions";

export namespace CommandSubscribe {

    function buildMassifMenu(mountain: string): Menu {
        const massifMenu = new Menu<Context>(`subscribe-massifs-${mountain}`);

        massifMenu.dynamic((_ctx, range) => {
            const massifs = MassifCache.getByMountain(mountain);

            for (const massif of massifs) {
                range.text(massif.name, async (context) => {
                    await ActionSubscriptions.subscribe(context, massif);
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
