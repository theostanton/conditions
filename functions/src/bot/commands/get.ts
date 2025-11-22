import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {MassifCache} from "@cache/MassifCache";
import {ActionBulletins} from "@bot/actions/bulletins";
import {Analytics} from "@analytics/Analytics";
import {ContentTypes, Massif} from "@app-types";
import {CONTENT_TYPE_CONFIGS} from "@constants/contentTypes";

export namespace CommandGet {

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
            await ctx.editMessageText(`Select massif in ${mountain} to get conditions for`).catch(err =>
                console.error('Error updating message text:', err)
            );
        });

        return contentTypeMenu;
    }

    function buildMassifMenu(mountain: string): Menu {
        const massifMenu = new Menu<Context>(`get-massifs-${mountain}`);
        const massifs = MassifCache.getByMountain(mountain);

        // Build the dynamic massif selection menu FIRST
        massifMenu.dynamic((_ctx, range) => {
            const massifs = MassifCache.getByMountain(mountain);

            for (const massif of massifs) {
                range.submenu(massif.name, `get-content-${massif.code}`, async (ctx) => {
                    await ctx.editMessageText(`Download current conditions for ${massif.name}`).catch(err =>
                        console.error('Error updating message text:', err)
                    );
                }).row();
            }
        });

        massifMenu.back("← Back to mountains", async (ctx) => {
            await ctx.editMessageText("First, select the range").catch(err =>
                console.error('Error updating message text:', err)
            );
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
                    await ctx.editMessageText(`Select massif in ${mountain} to get conditions for`).catch(err =>
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
                await context.reply("Unable to identify user");
                return;
            }
            await context.reply("First, select the range", {reply_markup: mountainMenu});
        };
    }

    export async function attach(bot: Bot) {
        const menu = buildMountainMenu();
        bot.use(menu);
        bot.command("get", commandGet(menu));
    }


}