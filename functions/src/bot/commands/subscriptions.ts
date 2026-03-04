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
import {getProviderForRegion} from "@providers/registry";

export namespace CommandSubscriptions {

    // Store content type menus for cross-navigation
    const contentTypeMenus = new Map<string, Menu>();

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
    export function getContentTypeMenu(massifCode: string): Menu | undefined {
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
                ctx.from.id.toString(),
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

    /**
     * Build a subscription region menu for a non-France country.
     * For single-content-type providers, subscribe/unsubscribe directly (bulletin only).
     */
    function buildRegionMenu(country: string): Menu {
        const regionMenu = new Menu<Context>(`subscriptions-regions-${country}`);

        regionMenu.back("← Back", async (ctx) => {
            await ctx.editMessageText(BotMessages.menuHeaders.selectCountry, {parse_mode: BotMessages.parseMode}).catch(err =>
                console.error('Error updating message text:', err)
            );
        }).row();

        regionMenu.dynamic(async (ctx, range) => {
            if (!ctx.from?.id) return;

            const regions = MassifCache.getByCountry(country);

            const subscriptionStatuses = await Subscriptions.getSubscriptionStatuses(
                ctx.from.id.toString(),
                regions.map(r => r.code)
            );

            for (const region of regions) {
                const isSubscribed = subscriptionStatuses.get(region.code) || false;
                const label = isSubscribed ? `☑️ ${region.name}` : `◻ ${region.name}`;

                if (isSubscribed) {
                    range.text(label, async (context) => {
                        await ActionSubscriptions.unsubscribe(context, region);
                    }).row();
                } else {
                    const provider = getProviderForRegion(region.code);
                    const contentTypes = provider?.getAvailableContentTypes() ?? ['bulletin'];

                    if (contentTypes.length === 1 && contentTypes[0] === 'bulletin') {
                        // Single content type — subscribe directly with bulletin only
                        range.text(label, async (context) => {
                            await ActionSubscriptions.subscribeBulletinOnly(context, region);
                        }).row();
                    } else {
                        range.submenu(label, `content-types-${region.code}`, async (ctx) => {
                            if (!ctx.from?.id) return;
                            ActionSubscriptions.initializeContentTypes(ctx.from.id, region);
                            await ctx.editMessageText(BotMessages.menuHeaders.chooseContent(region.name), {parse_mode: BotMessages.parseMode}).catch(err =>
                                console.error('Error updating message text:', err)
                            );
                        }).row();
                    }
                }
            }
        });

        // Register content type menus for multi-content-type regions
        const regions = MassifCache.getByCountry(country);
        for (const region of regions) {
            const provider = getProviderForRegion(region.code);
            const contentTypes = provider?.getAvailableContentTypes() ?? ['bulletin'];
            if (contentTypes.length > 1) {
                const contentMenu = buildContentTypeMenu(region);
                regionMenu.register(contentMenu);
            }
        }

        return regionMenu;
    }

    function buildMountainMenu(): Menu {
        const mountainMenu = new Menu<Context>("subscriptions-mountains");

        mountainMenu.back("← Back", async (ctx) => {
            await ctx.editMessageText(BotMessages.menuHeaders.selectCountry, {parse_mode: BotMessages.parseMode}).catch(err =>
                console.error('Error updating message text:', err)
            );
        }).row();

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

    function buildCountryMenu(): Menu {
        const countryMenu = new Menu<Context>("subscriptions-countries");

        countryMenu.dynamic((_ctx, range) => {
            const countries = MassifCache.getCountries();
            for (const country of countries) {
                if (country === 'France') {
                    range.submenu(country, "subscriptions-mountains", async (ctx) => {
                        await ctx.editMessageText(BotMessages.menuHeaders.selectRange, {parse_mode: BotMessages.parseMode}).catch(err =>
                            console.error('Error updating message text:', err)
                        );
                    }).row();
                } else {
                    range.submenu(country, `subscriptions-regions-${country}`, async (ctx) => {
                        await ctx.editMessageText(BotMessages.menuHeaders.selectRegion(country), {parse_mode: BotMessages.parseMode}).catch(err =>
                            console.error('Error updating message text:', err)
                        );
                    }).row();
                }
            }
        });

        // Register the mountain menu (France)
        const mountainMenu = buildMountainMenu();
        countryMenu.register(mountainMenu);

        // Register region menus for non-France countries
        const countries = MassifCache.getCountries();
        for (const country of countries) {
            if (country !== 'France') {
                const regionMenu = buildRegionMenu(country);
                countryMenu.register(regionMenu);
            }
        }

        return countryMenu;
    }

    function command(countryMenu: Menu): (ctx: Context) => Promise<void> {
        return async (ctx: Context) => {
            if (!ctx.from?.id) {
                await ctx.reply(BotMessages.errors.unableToIdentifyUser);
                return;
            }
            await ctx.reply(BotMessages.menuHeaders.selectCountry, {reply_markup: countryMenu, parse_mode: BotMessages.parseMode});
        };
    }

    export async function attach(bot: Bot): Promise<Menu> {
        const menu = buildCountryMenu();
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
