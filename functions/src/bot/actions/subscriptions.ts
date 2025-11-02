import {Context} from "grammy";
import {Subscriptions} from "@database/models/Subscriptions";
import {Massif} from "@app-types";
import {ActionBulletins} from "@bot/actions/bulletins";
import {Massifs} from "@database/models/Massifs";

export namespace ActionSubscriptions {

    export async function toggle(context: Context, massif: Massif): Promise<void> {
        try {
            if (!context.from?.id) {
                await context.reply("Unable to identify user");
                return;
            }

            const recipientId = context.from.id;
            const isSubscribed = await Subscriptions.isSubscribed(recipientId, massif.code);

            if (isSubscribed) {
                // Unsubscribe
                await Subscriptions.unsubscribe(recipientId, massif);
                await context.reply(`Unsubscribed from ${massif.name}`);
            } else {
                // Subscribe
                await Subscriptions.subscribe(recipientId, massif);
                await context.reply(`Subscribed to ${massif.name}`);
                await ActionBulletins.send(context, massif, false);
            }

            // Update the menu to show the new subscription status
            if (context.callbackQuery) {
                await context.editMessageText(context.message?.text || "Choose a mountain range");
            }
        } catch (error) {
            console.error('Error toggling subscription:', error);
            await context.reply(`Failed to update subscription for ${massif.name}. Please try again.`);
        }
    }

    export async function subscribe(context: Context, massif: Massif, sendBulletin: boolean = true): Promise<void> {
        try {
            if (!context.from?.id) {
                await context.reply("Unable to identify user");
                return;
            }

            const recipientId = context.from.id;
            const alreadySubscribed = await Subscriptions.isSubscribed(recipientId, massif.code);

            if (alreadySubscribed) {
                await context.answerCallbackQuery(`You are already subscribed to ${massif.name}`);
            } else {
                await Subscriptions.subscribe(recipientId, massif);

                // Update the menu to show the new subscription status
                await context.editMessageText(context.message?.text || "Choose a massif to subscribe to");

                if (sendBulletin) {
                    await ActionBulletins.send(context, massif, false);
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

            // Update the menu with the new list of massifs
            const remainingMassifs = await Massifs.getAllForRecipient(context.from.id);

            if (remainingMassifs.length === 0) {
                await context.editMessageText("You are now unsubscribed from all BERAs");
            } else {
                await context.editMessageText("Choose a massif to unsubscribe from");
            }
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
            await context.editMessageText("You are now unsubscribed from all BERAs");
        } catch (error) {
            console.error('Error unsubscribing from all:', error);
            await context.reply("Failed to unsubscribe. Please try again.");
        }
    }
}
