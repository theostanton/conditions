import {Bot, Context} from "grammy";
import {Menu} from "@grammyjs/menu";
import {MassifCache} from "@cache/MassifCache";
import {ActionBulletins} from "@bot/actions/bulletins";

export namespace CommandGet {

    function buildMassifMenu(mountain: string): Menu {
        const massifMenu = new Menu<Context>(`get-massifs-${mountain}`);

        massifMenu.dynamic((_ctx, range) => {
            const massifs = MassifCache.getByMountain(mountain);

            for (const massif of massifs) {
                range.text(massif.name, async (context) => {
                    await ActionBulletins.send(context, massif, true);
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