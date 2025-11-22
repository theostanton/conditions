import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {MassifCache} from "@cache/MassifCache";
import {ActionSubscriptions} from "@bot/actions/subscriptions";
import {Subscriptions} from "@database/models/Subscriptions";
import {Analytics} from "@analytics/Analytics";
import {Massif} from "@app-types";
import {CONTENT_TYPE_CONFIGS} from "@constants/contentTypes";

export namespace CommandSubscriptions {

    function buildContentTypeMenu(massif: Massif): Menu {
        const contentMenu = new Menu<Context>(`content-types-${massif.code}`);

        contentMenu.dynamic(async (ctx, range) => {
            if (!ctx.from?.id) return;

            const contentTypes = ActionSubscriptions.getContentTypes(ctx.from.id, massif);

            for (const config of CONTENT_TYPE_CONFIGS) {
                const isChecked = contentTypes[config.key] || false;
                const label = isChecked ? `☑️ ${config.emoji} ${config.label}` : `◻ ${config.emoji} ${config.label}`;

                range.text(label, async (context) => {
                    if (!context.from?.id) return;
                    ActionSubscriptions.toggleContentType(context.from.id, massif, config.key);
                    await context.menu.update({immediate: true}).catch(err =>
                        console.error('Error updating menu:', err)
                    );
                }).row();
            }
        });

        contentMenu.text("✅ Subscribe", async (ctx) => {
            await ActionSubscriptions.saveContentTypes(ctx, massif);
        }).row();

        return contentMenu;
    }

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

                if (isSubscribed) {
                    // If subscribed, clicking will unsubscribe
                    range.text(label, async (context) => {
                        await ActionSubscriptions.unsubscribe(context, massif);
                    }).row();
                } else {
                    // If not subscribed, show the content type selection menu
                    range.submenu(label, `content-types-${massif.code}`, async (ctx) => {
                        if (!ctx.from?.id) return;
                        // Initialize content types when entering the submenu
                        ActionSubscriptions.initializeContentTypes(ctx.from.id, massif);
                        // Update message text to show massif name
                        await ctx.editMessageText(`Select content in ${massif.name} to subscribe to`).catch(err =>
                            console.error('Error updating message text:', err)
                        );
                    }).row();
                }
            }
        });

        massifMenu.back("← Back to mountains", async (ctx) => {
            await ctx.editMessageText("First, select the range").catch(err =>
                console.error('Error updating message text:', err)
            );
        });

        // Register all content type submenus for this mountain
        const massifs = MassifCache.getByMountain(mountain);
        for (const massif of massifs) {
            const contentMenu = buildContentTypeMenu(massif);
            massifMenu.register(contentMenu);
        }

        return massifMenu;
    }

    function buildMountainMenu(): Menu {
        const mountainMenu = new Menu<Context>("subscriptions-mountains");

        mountainMenu.dynamic((_ctx, range) => {
            // Use cached data - no DB query!
            const mountains = MassifCache.getMountains();
            for (const mountain of mountains) {
                range.submenu(mountain, `subscriptions-massifs-${mountain}`, async (ctx) => {
                    await ctx.editMessageText(`Toggle your subscriptions in ${mountain}`).catch(err =>
                        console.error('Error updating message text:', err)
                    );
                }).row();
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
            await ctx.reply("First, select the range", {reply_markup: mountainMenu});
        };
    }

    export async function attach(bot: Bot) {
        const menu = buildMountainMenu();
        bot.use(menu);
        bot.command("subscriptions", command(menu));
    }
}
