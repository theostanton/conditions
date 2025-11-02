import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {MassifCache} from "@cache/MassifCache";
import {Bulletins} from "@database/models/Bulletins";
import {Massif} from "@app-types";


export namespace CommandGet {

    export async function send(context: Context, massif: Massif) {
        try {
            const bulletin = await Bulletins.getLatest(massif.code);

            if (bulletin === undefined) {
                await context.reply(`No bulletin for ${massif.name}`);
            } else if (bulletin.valid_to < new Date()) {
                await context.replyWithDocument(bulletin.public_url);
                await context.reply(`Latest bulletin for ${massif.name} is outdated`);
            } else {
                await context.replyWithDocument(bulletin.public_url);
            }
        } catch (error) {
            console.error('Error sending bulletin:', error);
            await context.reply(`Failed to retrieve bulletin for ${massif.name}. Please try again.`);
        }
    }

    function buildMassifMenu(mountain: string): Menu {
        const massifMenu = new Menu<Context>(`get-massifs-${mountain}`);

        massifMenu.dynamic((_ctx, range) => {
            const massifs = MassifCache.getByMountain(mountain);

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
            const mountains = MassifCache.getMountains();
            for (const mountain of mountains) {
                range.submenu(mountain, `get-massifs-${mountain}`).row();
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

    function commandGet(mountainMenu: Menu): (context: Context) => Promise<void> {
        return async (context: Context) => {
            if (!context.from?.id) {
                await context.reply("Unable to identify user");
                return;
            }
            await context.reply("Choose a mountain range", {reply_markup: mountainMenu});
        };
    }

    export async function attach(bot: Bot) {
        const menu = buildMountainMenu();
        bot.use(menu);
        bot.command("get", commandGet(menu));
    }


}