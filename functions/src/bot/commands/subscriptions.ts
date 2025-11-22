import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {MassifCache} from "@cache/MassifCache";
import {ActionSubscriptions} from "@bot/actions/subscriptions";
import {Subscriptions} from "@database/models/Subscriptions";
import {Analytics} from "@analytics/Analytics";

export namespace CommandSubscriptions {

    function buildMassifMenu(mountain: string): Menu {
        const massifMenu = new Menu<Context>(`subscriptions-massifs-${mountain}`);

        massifMenu.dynamic(async (ctx, range) => {
            if (!ctx.from?.id) return;

            const massifs = MassifCache.getByMountain(mountain);

            // Batch fetch all subscription statuses to reduce database queries
            const subscriptionStatuses = await Subscriptions.getSubscriptionStatuses(
                ctx.from.id,
                massifs.map(m => m.code)
            );

            for (const massif of massifs) {
                const isSubscribed = subscriptionStatuses.get(massif.code) || false;
                const label = isSubscribed ? `☑️ ${massif.name}` : `◻ ${massif.name}`;

                range.text(label, async (context) => {
                    await ActionSubscriptions.toggle(context, massif);
                }).row();
            }
        });

        massifMenu.back("← Back to mountains");

        return massifMenu;
    }

    function buildMountainMenu(): Menu {
        const mountainMenu = new Menu<Context>("subscriptions-mountains");

        mountainMenu.dynamic((_ctx, range) => {
            // Use cached data - no DB query!
            const mountains = MassifCache.getMountains();
            for (const mountain of mountains) {
                range.submenu(mountain, `subscriptions-massifs-${mountain}`).row();
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
            await ctx.reply("Toggle your subscriptions:", {reply_markup: mountainMenu});
        };
    }

    export async function attach(bot: Bot) {
        const menu = buildMountainMenu();
        bot.use(menu);
        bot.command("subscriptions", command(menu));
    }
}
