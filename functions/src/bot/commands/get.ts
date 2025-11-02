import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {Massifs} from "@database/models/Massifs";
import {Bulletins} from "@database/models/Bulletins";
import {Massif} from "@app-types";


export namespace CommandGet {

    // Cache for mountains data
    let mountainsCache: string[] = [];

    async function initializeCache() {
        mountainsCache = await Massifs.getDistinctMountains();
    }

    export async function send(context: Context, massif: Massif) {
        const bulletin = await Bulletins.getLatest(massif.code);

        if (bulletin === undefined) {
            await context.reply(`No bulletin for ${massif.name}`);
        } else if (bulletin.valid_to < new Date()) {
            // await context.reply(`No valid bulletin for ${massif.name}`);
            await context.replyWithDocument(bulletin.public_url);
            await context.reply(`Bulletin for ${massif.name} is outdated`);
        } else {
            await context.replyWithDocument(bulletin.public_url);
        }
    }

    function buildMassifMenu(mountain: string): Menu {
        const massifMenu = new Menu<Context>(`get-massifs-${mountain}`);

        massifMenu.dynamic(async (_ctx, range) => {
            const massifs = await Massifs.getByMountain(mountain);

            for (const massif of massifs) {
                range.text(massif.name, async (context) => {
                    await send(context, massif);
                }).row();
            }
        });

        massifMenu.back("← Back to mountains");

        return massifMenu;
    }

    function buildMountainMenu(): Menu {
        const mountainMenu = new Menu<Context>("get-mountains");

        mountainMenu.dynamic((_ctx, range) => {
            for (const mountain of mountainsCache) {
                range.submenu(mountain, `get-massifs-${mountain}`).row();
            }
        });

        // Register all massif submenus
        for (const mountain of mountainsCache) {
            const massifMenu = buildMassifMenu(mountain);
            mountainMenu.register(massifMenu);
        }

        return mountainMenu;
    }

    function commandGet(mountainMenu: Menu): (context: Context) => Promise<void> {
        return async (context: Context) => {
            await context.reply("Choose a mountain range", {reply_markup: mountainMenu});
        };
    }

    export async function attach(bot: Bot) {
        await initializeCache();
        const menu = buildMountainMenu();
        bot.use(menu);
        bot.command("get", commandGet(menu));
    }


}