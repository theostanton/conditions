import {config} from "dotenv";
import {Bot, InlineKeyboard, Keyboard} from "grammy";
import {Menu} from "@grammyjs/menu";

import {connect} from 'ts-postgres';

config()


type Massif = { name: string, code: number }

async function main() {

    const client = await connect({
        host: process.env.PGHOST,
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
    })

    async function subscribe(userId: number, massif: Massif) {
        await client.query("INSERT INTO recipients (number) VALUES ($1) on conflict(number) DO NOTHING", [userId])
        await client.query("INSERT INTO subscriptions_bras (recipient, massif) VALUES ($1, $2)", [userId, massif.code])
    }

    async function unsubscribe(userId: number, massif: Massif) {
        await client.query("DELETE FROM subscriptions_bras WHERE recipient = $1 AND massif = $2", [userId, massif.code])
    }

    console.log("Connected to database.")

    const result = await client.query<Massif>("SELECT name,code FROM massifs ORDER BY name")
    const massifs = [...result]

    const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN as string)

    async function setup() {
        await bot.api.setMyCommands([
            {command: "get", description: "Get the latest BRA"},
            {command: "subscribe", description: "Subscribe to a BRA"},
            {command: "unsubscribe", description: "Unsubscribe from a BRA"},
        ]);
    }

    setup().then(() => console.log("Setup done."))

    const getMenu = new Menu("get",)

    massifs.forEach(massif => {
        getMenu.text(massif.name, async context => {
            await context.replyWithDocument("https://storage.googleapis.com/conditions-450312-bras/Aravis.pdf")
        }).row()
    })

    bot.use(getMenu);

    const subscribeMenu = new Menu("subscribe")

    massifs.forEach(massif => {
        subscribeMenu.text(massif.name, async context => {
            await subscribe(context.from?.id as number, massif)
            await context.reply(`You are now subscribed to ${massif.name}`)
        }).row()
    })

    bot.use(subscribeMenu);

// Get
    bot.command("get", async (ctx) => {
        await ctx.reply("Get the latest BRA", {reply_markup: getMenu});
    });

// Subscribe
    bot.command("subscribe", async (ctx) => {

        await ctx.reply("Subscribe to BRAs", {reply_markup: subscribeMenu});
    });

// Unsubscribe
    bot.command("unsubscribe", async (ctx) => {
        const recipientMassifsResult = await client.query<Massif>("SELECT m.name, m.code FROM subscriptions_bras as sb left join massifs m on sb.massif = m.code WHERE sb.recipient = $1", [ctx.from?.id as number])
        const recipientMassifs = [...recipientMassifsResult]

        const keyboard = new Keyboard()

        recipientMassifs.forEach(massif => {
            keyboard.text(`Unsubscribe ${massif.name}`).row()
        })

        keyboard.resized(false)

        await ctx.reply("Unsubscribe from BRAs", {reply_markup: keyboard});
    });

    bot.hears(/Unsubscribe *(.+)?/, async (context) => {
        await unsubscribe(context.from?.id as number, massif)
        await context.reply(`You are now unsubscribed from ${context.message?.text}`)
    })

    await bot.start();

}

main().then()