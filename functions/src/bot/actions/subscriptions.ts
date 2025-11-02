import {Context} from "grammy";
import {Subscriptions} from "@database/models/Subscriptions";
import {Massif} from "@app-types";
import {ActionBulletins} from "@bot/actions/bulletins";

export namespace ActionSubscriptions {

    export async function subscribe(context: Context, massif: Massif, sendBulletin: boolean = true): Promise<void> {
        try {
            if (!context.from?.id) {
                await context.reply("Unable to identify user");
                return;
            }

            const recipientId = context.from.id;
            const alreadySubscribed = await Subscriptions.isSubscribed(recipientId, massif.code);

            if (alreadySubscribed) {
                await context.reply(`You are already subscribed to ${massif.name}`);
            } else {
                await Subscriptions.subscribe(recipientId, massif);
                await context.reply(`You are now subscribed to ${massif.name}`);

                if (sendBulletin) {
                    await ActionBulletins.send(context, massif);
                }
            }
        } catch (error) {
            console.error('Error subscribing:', error);
            await context.reply(`Failed to subscribe to ${massif.name}. Please try again.`);
        }
    }

    export async function unsubscribe(context: Context, massif: Massif): Promise<void> {
        try {
            if (!context.from?.id) {
                await context.reply("Unable to identify user");
                return;
            }

            await Subscriptions.unsubscribe(context.from.id, massif);
            await context.reply(`You are now unsubscribed from ${massif.name}`);
        } catch (error) {
            console.error('Error unsubscribing:', error);
            await context.reply(`Failed to unsubscribe from ${massif.name}. Please try again.`);
        }
    }

    export async function unsubscribeAll(context: Context): Promise<void> {
        try {
            if (!context.from?.id) {
                await context.reply("Unable to identify user");
                return;
            }

            await Subscriptions.unsubscribeAll(context.from.id);
            await context.reply("Unsubscribed from all BRAs");
        } catch (error) {
            console.error('Error unsubscribing from all:', error);
            await context.reply("Failed to unsubscribe. Please try again.");
        }
    }
}
