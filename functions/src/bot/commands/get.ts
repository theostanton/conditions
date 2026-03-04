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
import {getProviderForRegion} from "@providers/registry";

export namespace CommandGet {

    // Store content type menus for cross-navigation
    const contentTypeMenus = new Map<string, Menu>();

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
    export function getContentTypeMenu(massifCode: string): Menu | undefined {
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

        mountainMenu.back("← Back", async (ctx) => {
            await ctx.editMessageText(BotMessages.menuHeaders.selectCountry, {parse_mode: BotMessages.parseMode}).catch(err =>
                console.error('Error updating message text:', err)
            );
        }).row();

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

    /**
     * Build a region menu for a non-France country.
     * Since EAWS/SLF providers only have 'bulletin' content type,
     * selecting a region delivers the bulletin directly (no content type submenu).
     */
    function buildRegionMenu(country: string): Menu {
        const regionMenu = new Menu<Context>(`get-regions-${country}`);

        regionMenu.back("← Back", async (ctx) => {
            await ctx.editMessageText(BotMessages.menuHeaders.selectCountry, {parse_mode: BotMessages.parseMode}).catch(err =>
                console.error('Error updating message text:', err)
            );
        }).row();

        regionMenu.dynamic((_ctx, range) => {
            const regions = MassifCache.getByCountry(country);

            for (const region of regions) {
                const provider = getProviderForRegion(region.code);
                const contentTypes = provider?.getAvailableContentTypes() ?? ['bulletin'];

                if (contentTypes.length === 1 && contentTypes[0] === 'bulletin') {
                    // Single content type — deliver directly
                    range.text(region.name, async (ctx) => {
                        try {
                            const bulletinOnly: ContentTypes = {
                                bulletin: true, snow_report: false, fresh_snow: false,
                                weather: false, last_7_days: false, rose_pentes: false, montagne_risques: false,
                            };
                            await ActionBulletins.send(ctx, region, true, bulletinOnly);
                            Analytics.send(`${ctx.from?.id} got ${region.name} - bulletin`).catch(console.error);
                        } catch (error) {
                            console.error(`Error sending bulletin for ${region.name}:`, error);
                            try { await ctx.reply('Failed to send bulletin. Please try again.'); } catch {}
                        }
                    }).row();
                } else {
                    // Multiple content types — use submenu (same as French massifs)
                    range.submenu(region.name, `get-content-${region.code}`, async (ctx) => {
                        await ctx.editMessageText(BotMessages.menuHeaders.download(region.name), {parse_mode: BotMessages.parseMode}).catch(err =>
                            console.error('Error updating message text:', err)
                        );
                    }).row();
                }
            }
        });

        // Register content type menus for regions that have multiple content types
        const regions = MassifCache.getByCountry(country);
        for (const region of regions) {
            const provider = getProviderForRegion(region.code);
            const contentTypes = provider?.getAvailableContentTypes() ?? ['bulletin'];
            if (contentTypes.length > 1) {
                const contentTypeMenu = buildContentTypeMenu(region);
                regionMenu.register(contentTypeMenu);
            }
        }

        return regionMenu;
    }

    function buildCountryMenu(): Menu {
        const countryMenu = new Menu<Context>("get-countries");

        // Build the dynamic country selection menu
        countryMenu.dynamic((_ctx, range) => {
            const countries = MassifCache.getCountries();
            for (const country of countries) {
                if (country === 'France') {
                    // France → existing mountain menu
                    range.submenu(country, "get-mountains", async (ctx) => {
                        await ctx.editMessageText(BotMessages.menuHeaders.selectRange, {parse_mode: BotMessages.parseMode}).catch(err =>
                            console.error('Error updating message text:', err)
                        );
                    }).row();
                } else {
                    // Other countries → region list
                    range.submenu(country, `get-regions-${country}`, async (ctx) => {
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

    function commandGet(countryMenu: Menu): (context: Context) => Promise<void> {
        return async (context: Context) => {
            if (!context.from?.id) {
                await context.reply(BotMessages.errors.unableToIdentifyUser);
                return;
            }
            await context.reply(BotMessages.menuHeaders.selectCountry, {
                reply_markup: countryMenu,
                parse_mode: BotMessages.parseMode
            });
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

        bot.command("get", commandGet(menu));
        return menu;
    }


}
