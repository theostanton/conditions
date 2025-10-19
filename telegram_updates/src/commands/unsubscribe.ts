import {Bot, Context} from "grammy";
import {buildUnsubscribeKeyboard} from '../bot/keyboards';
import type {Massif} from '../types';
import {Subscriptions} from "../database/Subscriptions";
import {Massifs} from "../database/Massifs";

export namespace CommandUnsubscribe {

    function commandUnsubscribe(massifs: Massif[]): (ctx: Context) => Promise<void> {
        return async (ctx: Context) => {
            if (ctx.match === "") {
                const keyboard = await buildUnsubscribeKeyboard(ctx);
                await ctx.reply("Unsubscribe from BRAs", {reply_markup: keyboard});
            } else if (ctx.match === "all") {
                await Subscriptions.unsubscribeAll(ctx.from?.id as number);
                await ctx.reply("Unsubscribed from all BRAs", {reply_markup: {remove_keyboard: true}});
            } else {
                const massif = massifs.find(m => ctx.match === m.name);
                if (massif) {
                    await Subscriptions.unsubscribe(ctx.from?.id as number, massif);
                    const keyboard = await buildUnsubscribeKeyboard(ctx);
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
        const massifs = await Massifs.getAll()
        bot.command("unsubscribe", commandUnsubscribe(massifs))
    }
}

