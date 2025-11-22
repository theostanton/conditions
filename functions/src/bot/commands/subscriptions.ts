import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {MassifCache} from "@cache/MassifCache";
import {ActionSubscriptions} from "@bot/actions/subscriptions";
import {Subscriptions} from "@database/models/Subscriptions";
import {Analytics} from "@analytics/Analytics";
import {Massif} from "@app-types";

export namespace CommandSubscriptions {

    function buildContentTypeMenu(massif: Massif): Menu {
        const contentMenu = new Menu<Context>(`content-types-${massif.code}`);

        contentMenu.dynamic(async (ctx, range) => {
            if (!ctx.from?.id) return;

            const contentTypes = ActionSubscriptions.getContentTypes(ctx.from.id, massif);

            // Content type options
            const types: Array<{key: keyof typeof contentTypes, label: string}> = [
                {key: 'bulletin', label: 'Bulletin'},
                {key: 'snow_report', label: 'Snow Report'},
                {key: 'fresh_snow', label: 'Fresh Snow'},
                {key: 'weather', label: 'Weather'},
                {key: 'last_7_days', label: 'Last 7 Days'},
            ];

            for (const type of types) {
                const isChecked = contentTypes[type.key] || false;
                const label = isChecked ? `☑️ ${type.label}` : `◻ ${type.label}`;

                range.text(label, async (context) => {
                    if (!context.from?.id) return;
                    ActionSubscriptions.toggleContentType(context.from.id, massif, type.key);
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
                    }).row();
                }
            }
        });

        massifMenu.back("← Back to mountains");

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
            await ctx.reply("Choose a mountain range to manage your subscriptions", {reply_markup: mountainMenu});
        };
    }

    export async function attach(bot: Bot) {
        const menu = buildMountainMenu();
        bot.use(menu);
        bot.command("subscriptions", command(menu));
    }
}
