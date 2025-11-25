import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {MassifCache} from "@cache/MassifCache";
import {ActionBulletins} from "@bot/actions/bulletins";
import {Analytics} from "@analytics/Analytics";
import {ContentTypes, Massif} from "@app-types";
import {CONTENT_TYPE_CONFIGS} from "@constants/contentTypes";
import {ActionSubscriptions} from "@bot/actions/subscriptions";
import {CommandSubscriptions} from "@bot/commands/subscriptions";
import {BotMessages} from "@bot/messages";

export namespace CommandGet {

    // Store content type menus for cross-navigation
    const contentTypeMenus = new Map<number, Menu>();

    function buildContentTypeMenu(massif: Massif): Menu {
        const contentTypeMenu = new Menu<Context>(`get-content-${massif.code}`);

        // Helper to create a content type button handler
        const createContentHandler = (
            contentTypes: ContentTypes,
            analyticsLabel: string,
            errorMessage: string
        ) => {
            return async (context: Context) => {
                try {
                    await ActionBulletins.send(context, massif, true, contentTypes);

                    try {
                        await Analytics.send(`${context.from?.id} got ${massif.name} - ${analyticsLabel}`);
                    } catch (analyticsError) {
                        console.error('Analytics error (non-critical):', analyticsError);
                    }
                } catch (error) {
                    console.error(`Error sending ${analyticsLabel}:`, error);
                    try {
                        await context.reply(errorMessage);
                    } catch (replyError) {
                        console.error('Failed to send error message:', replyError);
                    }
                }
            };
        };

        contentTypeMenu.back("← Back", async (ctx) => {
            // Find the mountain name for this massif to restore the title
            const mountains = MassifCache.getMountains();
            let mountain = '';
            for (const m of mountains) {
                const massifs = MassifCache.getByMountain(m);
                if (massifs.some(ms => ms.code === massif.code)) {
                    mountain = m;
                    break;
                }
            }
            await ctx.editMessageText(BotMessages.menuHeaders.selectMassif(mountain), {parse_mode: BotMessages.parseMode}).catch(err =>
                console.error('Error updating message text:', err)
            );
        }).row();


        // Add Subscribe button to switch to subscriptions menu
        // contentTypeMenu.text("Subscribe", async (ctx) => {
        //     if (!ctx.from?.id) return;
        //
        //     try {
        //         // Initialize content types for subscription (default: bulletin only)
        //         ActionSubscriptions.initializeContentTypes(ctx.from.id, massif);
        //
        //         // Get the target subscriptions menu
        //         const subsMenu = CommandSubscriptions.getContentTypeMenu(massif.code);
        //         if (!subsMenu) {
        //             console.error(`Subscriptions menu not found for massif ${massif.code}`);
        //             return;
        //         }
        //
        //         // Update the message text and reply markup to the subscriptions menu
        //         await ctx.editMessageText(BotMessages.menuHeaders.chooseContent(massif.name), {
        //             parse_mode: BotMessages.parseMode,
        //             reply_markup: subsMenu
        //         }).catch(err => {
        //             console.error('Error updating message:', err);
        //         });
        //     } catch (err) {
        //         console.error('Error navigating to subscriptions:', err);
        //     }
        // }).row();

        // Add "All Content" button
        const allContentTypes: ContentTypes = {
            bulletin: true,
            snow_report: true,
            fresh_snow: true,
            weather: true,
            last_7_days: true,
            rose_pentes: true,
            montagne_risques: true
        };

        contentTypeMenu.text("✨ All Content", createContentHandler(
            allContentTypes,
            'all',
            'Failed to send content. Please try again.'
        )).row();


        // Helper to create ContentTypes object with only one type enabled
        const createSingleContentType = (key: keyof ContentTypes): ContentTypes => {
            const result: ContentTypes = {
                bulletin: false,
                snow_report: false,
                fresh_snow: false,
                weather: false,
                last_7_days: false,
                rose_pentes: false,
                montagne_risques: false
            };
            result[key] = true;
            return result;
        };

        // Add individual content type buttons
        for (const config of CONTENT_TYPE_CONFIGS) {
            contentTypeMenu.text(`${config.emoji} ${config.label}`, createContentHandler(
                createSingleContentType(config.key),
                config.key,
                `Failed to send ${config.label.toLowerCase()}. Please try again.`
            )).row();
        }

        // Store menu for cross-registration
        contentTypeMenus.set(massif.code, contentTypeMenu);

        return contentTypeMenu;
    }

    // Getter for cross-registration with subscriptions menu
    export function getContentTypeMenu(massifCode: number): Menu | undefined {
        return contentTypeMenus.get(massifCode);
    }

    function buildMassifMenu(mountain: string): Menu {
        const massifMenu = new Menu<Context>(`get-massifs-${mountain}`);
        const massifs = MassifCache.getByMountain(mountain);

        massifMenu.back("← Back", async (ctx) => {
            await ctx.editMessageText(BotMessages.menuHeaders.selectRange, {parse_mode: BotMessages.parseMode}).catch(err =>
                console.error('Error updating message text:', err)
            );
        }).row();

        // Build the dynamic massif selection menu FIRST
        massifMenu.dynamic((_ctx, range) => {
            const massifs = MassifCache.getByMountain(mountain);

            for (const massif of massifs) {
                range.submenu(massif.name, `get-content-${massif.code}`, async (ctx) => {
                    await ctx.editMessageText(BotMessages.menuHeaders.download(massif.name), {parse_mode: BotMessages.parseMode}).catch(err =>
                        console.error('Error updating message text:', err)
                    );
                }).row();
            }
        });

        // THEN register all content type menus for this mountain's massifs
        for (const massif of massifs) {
            const contentTypeMenu = buildContentTypeMenu(massif);
            massifMenu.register(contentTypeMenu);
        }

        return massifMenu;
    }

    function buildMountainMenu(): Menu {
        const mountainMenu = new Menu<Context>("get-mountains");

        // Build the dynamic mountain selection menu FIRST
        mountainMenu.dynamic((_ctx, range) => {
            const mountains = MassifCache.getMountains();
            for (const mountain of mountains) {
                range.submenu(mountain, `get-massifs-${mountain}`, async (ctx) => {
                    await ctx.editMessageText(BotMessages.menuHeaders.selectMassif(mountain), {parse_mode: BotMessages.parseMode}).catch(err =>
                        console.error('Error updating message text:', err)
                    );
                }).row();
            }
        });

        // THEN register all massif submenus
        const mountains = MassifCache.getMountains();
        for (const mountain of mountains) {
            const massifMenu = buildMassifMenu(mountain);
            mountainMenu.register(massifMenu);
        }

        return mountainMenu;
    }

    function commandGet(mountainMenu: Menu): (context: Context) => Promise<void> {
        return async (context: Context) => {
            if (!context.from?.id) {
                await context.reply(BotMessages.errors.unableToIdentifyUser);
                return;
            }
            await context.reply(BotMessages.menuHeaders.selectRange, {
                reply_markup: mountainMenu,
                parse_mode: BotMessages.parseMode
            });
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

        bot.command("get", commandGet(menu));
        return menu;
    }


}