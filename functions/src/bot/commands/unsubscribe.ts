import {Bot, Context, Keyboard} from "grammy";
import {Massifs} from "@database/models/Massifs";
import {Massif} from "@app-types";
import {Subscriptions} from "@database/models/Subscriptions";

export namespace CommandUnsubscribe {


    export async function buildKeyboard(context: Context, massifs: Massif[]): Promise<Keyboard | undefined> {

        if (massifs.length === 0) {
            await context.reply("You are not subscribed to any BRAs");
            return;
        }

        const keyboard = new Keyboard();

        keyboard.text(`/unsubscribe all`).row();
        massifs.forEach(massif => {
            keyboard.text(`/unsubscribe ${massif.name}`).row();
        });

        keyboard.resized(false);
        return keyboard;
    }

    function commandUnsubscribe(): (ctx: Context) => Promise<void> {

        return async (ctx: Context) => {
            const massifs = await Massifs.getAllForRecipient(ctx.from?.id as number);
            if (ctx.match === "") {
                const keyboard = await buildKeyboard(ctx, massifs);
                await ctx.reply("Unsubscribe from BRAs", {reply_markup: keyboard});
            } else if (ctx.match === "all") {
                await Subscriptions.unsubscribeAll(ctx.from?.id as number);
                await ctx.reply("Unsubscribed from all BRAs", {reply_markup: {remove_keyboard: true}});
            } else {
                const massif = massifs.find(m => ctx.match === m.name);
                if (massif) {
                    await Subscriptions.unsubscribe(ctx.from?.id as number, massif);
                    const keyboard = await buildKeyboard(ctx, massifs);
                    if (keyboard) {
                        await ctx.reply(`You are now unsubscribed from ${ctx.match}`, {reply_markup: keyboard});
                    } else {
                        await ctx.reply("Unsubscribed from all BRAs", {reply_markup: {remove_keyboard: true}});
                    }
                } else {
                    await ctx.reply(`Couldn't find the massif to unsubscribe for "${ctx.match}"`);
                }
            }
        };
    }

    export async function attach(bot: Bot) {
        bot.command("unsubscribe", commandUnsubscribe())
    }
}

