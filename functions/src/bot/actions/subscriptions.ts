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
            } else {
                // Subscribe
                await Subscriptions.subscribe(recipientId, massif);
                await ActionBulletins.send(context, massif, false);
            }

            // Update the menu to show the new subscription status
            if (context.callbackQuery) {
                await context.editMessageText(context.message?.text || "Toggle your subscriptions:");
            }
        } catch (error) {
            console.error('Error toggling subscription:', error);
            await context.reply(`Failed to update subscription for ${massif.name}. Please try again.`);
        }
    }
}
