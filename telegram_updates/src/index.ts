import {config} from "dotenv";
import {Bot, Context, InlineKeyboard, Keyboard} from "grammy";
import {Menu} from "@grammyjs/menu";

import {Client, connect} from 'ts-postgres';

config()

let client: Client

type Massif = { name: string, code: number }

async function executeSubscribe(userId: number, massif: Massif) {
    await client.query("INSERT INTO recipients (number) VALUES ($1) on conflict(number) DO NOTHING", [userId])
    await client.query("INSERT INTO subscriptions_bras (recipient, massif) VALUES ($1, $2)", [userId, massif.code])
}

async function executeUnsubscribe(userId: number, massif: Massif) {
    await client.query("DELETE FROM subscriptions_bras WHERE recipient = $1 AND massif = $2", [userId, massif.code])
}

async function unsubscribeKeyboard(context: Context): Promise<Keyboard | undefined> {
    const recipientMassifsResult = await client.query<Massif>("SELECT m.name, m.code FROM subscriptions_bras as sb left join massifs m on sb.massif = m.code WHERE sb.recipient = $1", [ctx.from?.id as number])
    const recipientMassifs = [...recipientMassifsResult]

    if (recipientMassifs.length == 0) {
        await context.reply("You are not subscribed to any BRAs")
        return
    }

    const keyboard = new Keyboard()

    keyboard.text(`/unsubscribe all`).row()
    recipientMassifs.forEach(massif => {
        keyboard.text(`/unsubscribe ${massif.name}`).row()
    })

    keyboard.resized(false)
    return keyboard
}

function commandUnsubscribe(massifs: any[]) {
    return async (ctx: Context) => {
        if (ctx.match == "") {
            const keyboard = await unsubscribeKeyboard(ctx)
            await ctx.reply("Unsubscribe from BRAs", {reply_markup: keyboard});
        } else if (ctx.match == "all") {
            await client.query("DELETE FROM subscriptions_bras WHERE recipient = $1", [ctx.from?.id as number])
            await ctx.reply("Unsubscribed from all BRAs", {reply_markup: {remove_keyboard: true}});
        } else {
            const massif = massifs.find(m => ctx.match == m.name)
            if (massif) {
                await executeUnsubscribe(ctx.from?.id as number, massif)
                const keyboard = await unsubscribeKeyboard(ctx)
                if (keyboard) {
                    await ctx.reply(`You are now unsubscribed from ${ctx.match}`, {reply_markup: keyboard})
                } else {
                    await ctx.reply("Unsubscribed from all BRAs", {reply_markup: {remove_keyboard: true}});
                }
            } else {
                await ctx.reply(`Couldn't find the massif to unsubscribe for "${ctx.match}"`)
            }
        }
    };
}

function commandSubscribe(subscribeMenu: Menu<Context>) {
    return async (ctx: Context) => {

        await ctx.reply("Subscribe to BRAs", {reply_markup: subscribeMenu});
    };
}

function commandGet(getMenu: Menu<Context>) {
    return async (context: Context) => {
        await context.reply("Get the latest BRA", {reply_markup: getMenu});
    };
}

async function main() {
    const result = await client.query<Massif>("SELECT name,code FROM massifs ORDER BY name")
    const allMassifs = [...result]

    const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN as string)

    async function setup() {
        client = await connect({
            host: process.env.PGHOST,
            database: process.env.PGDATABASE,
            user: process.env.PGUSER,
            password: process.env.PGPASSWORD,
        })

        await bot.api.setMyCommands([
            {command: "get", description: "Get the latest BRA"},
            {command: "subscribe", description: "Subscribe to a BRA"},
            {command: "unsubscribe", description: "Unsubscribe from a BRA"},
        ]);
    }

    setup().then(() => console.log("Setup done."))

    const getMenu = new Menu("get")

    allMassifs.forEach(massif => {
        getMenu.text(massif.name, async context => {
            await context.replyWithDocument("https://storage.googleapis.com/conditions-450312-bras/Aravis.pdf")
        }).row()
    })

    bot.use(getMenu);

    const subscribeMenu = new Menu("subscribe")

    allMassifs.forEach(massif => {
        subscribeMenu.text(massif.name, async context => {
            await executeSubscribe(context.from?.id as number, massif)
            await context.reply(`You are now subscribed to ${massif.name}`)
        }).row()
    })

    bot.use(subscribeMenu);

    bot.command("get", commandGet(getMenu));
    bot.command("subscribe", commandSubscribe(subscribeMenu));
    bot.command("unsubscribe", commandUnsubscribe(allMassifs));

    await bot.start();

}

main().then()