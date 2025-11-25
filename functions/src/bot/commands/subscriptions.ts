import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {MassifCache} from "@cache/MassifCache";
import {ActionSubscriptions} from "@bot/actions/subscriptions";
import {Subscriptions} from "@database/models/Subscriptions";
import {Analytics} from "@analytics/Analytics";
import {Massif} from "@app-types";
import {CONTENT_TYPE_CONFIGS} from "@constants/contentTypes";
import {CommandGet} from "@bot/commands/get";
import {BotMessages} from "@bot/messages";

export namespace CommandSubscriptions {

    // Store content type menus for cross-navigation
    const contentTypeMenus = new Map<number, Menu>();

    function buildContentTypeMenu(massif: Massif): Menu {
        const contentMenu = new Menu<Context>(`content-types-${massif.code}`);

        // Add back button to switch to get menu
        contentMenu.text("← Back", async (ctx) => {
            if (!ctx.from?.id) return;

            try {
                // Clear any temporary subscription state
                ActionSubscriptions.clearContentTypes(ctx.from.id, massif);

                // Get the target get menu
                const getMenu = CommandGet.getContentTypeMenu(massif.code);
                if (!getMenu) {
                    console.error(`Get menu not found for massif ${massif.code}`);
                    return;
                }

                // Update the message text and reply markup to the get menu
                await ctx.editMessageText(BotMessages.menuHeaders.download(massif.name), {
                    parse_mode: BotMessages.parseMode,
                    reply_markup: getMenu
                }).catch(err => {
                    console.error('Error updating message:', err);
                });
            } catch (err) {
                console.error('Error navigating to get:', err);
            }
        }).row();

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

        contentMenu.text("✅ Save", async (ctx) => {
            await ActionSubscriptions.saveContentTypes(ctx, massif);
        }).row();

        // Store menu for cross-registration
        contentTypeMenus.set(massif.code, contentMenu);

        return contentMenu;
    }

    // Getter for cross-registration with get menu
    export function getContentTypeMenu(massifCode: number): Menu | undefined {
        return contentTypeMenus.get(massifCode);
    }

    function buildMassifMenu(mountain: string): Menu {
        const massifMenu = new Menu<Context>(`subscriptions-massifs-${mountain}`);

        massifMenu.back("← Back", async (ctx) => {
            await ctx.editMessageText(BotMessages.menuHeaders.selectRange, {parse_mode: BotMessages.parseMode}).catch(err =>
                console.error('Error updating message text:', err)
            );
        }).row();

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
                        await ctx.editMessageText(BotMessages.menuHeaders.chooseContent(massif.name), {parse_mode: BotMessages.parseMode}).catch(err =>
                            console.error('Error updating message text:', err)
                        );
                    }).row();
                }
            }
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
                    await ctx.editMessageText(BotMessages.menuHeaders.yourSubscriptions(mountain), {parse_mode: BotMessages.parseMode}).catch(err =>
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
                await ctx.reply(BotMessages.errors.unableToIdentifyUser);
                return;
            }
            await ctx.reply(BotMessages.menuHeaders.selectRange, {reply_markup: mountainMenu, parse_mode: BotMessages.parseMode});
        };
    }

    export async function attach(bot: Bot): Promise<Menu> {
        const menu = buildMountainMenu();
        bot.use(menu);

        // Also register all content type menus directly with the bot
        // so they can be used from other menu contexts
        for (const contentTypeMenu of contentTypeMenus.values()) {
            bot.use(contentTypeMenu);
        }

        bot.command("subscriptions", command(menu));
        return menu;
    }
}
