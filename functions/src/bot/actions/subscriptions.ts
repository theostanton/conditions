import {Context} from "grammy";
import {MenuFlavor} from "@grammyjs/menu";
import {Subscriptions} from "@database/models/Subscriptions";
import {Massif} from "@app-types";
import {ActionBulletins} from "@bot/actions/bulletins";
import {Analytics} from "@analytics/Analytics";

export namespace ActionSubscriptions {

    export async function toggle(context: Context & MenuFlavor, massif: Massif): Promise<void> {
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

                // Update menu immediately to reflect the change
                if (context.callbackQuery?.message) {
                    await context.menu.update({immediate: true}).catch(err =>
                        console.error('Error updating menu:', err)
                    );
                }

                // Analytics - non-blocking
                Analytics.send(`${context.from?.id} unsubscribed from ${massif.name}`).catch(err =>
                    console.error('Analytics error:', err)
                );
            } else {
                // Subscribe
                await Subscriptions.subscribe(recipientId, massif);

                // Update menu immediately to reflect the change
                if (context.callbackQuery?.message) {
                    await context.menu.update({immediate: true}).catch(err =>
                        console.error('Error updating menu:', err)
                    );
                }

                // Send bulletin asynchronously - don't block the menu update
                ActionBulletins.send(context, massif, false).catch(err =>
                    console.error('Error sending bulletin:', err)
                );

                // Analytics - non-blocking
                Analytics.send(`${context.from?.id} subscribed to ${massif.name}`).catch(err =>
                    console.error('Analytics error:', err)
                );
            }


        } catch (error) {
            console.error('Error toggling subscription:', error);

            // Answer callback if we haven't yet
            if (context.callbackQuery) {
                await context.answerCallbackQuery({
                    text: `Failed to update subscription for ${massif.name}`,
                    show_alert: true
                }).catch(() => {
                });
            }

            await context.reply(`Failed to update subscription for ${massif.name}. Please try again.`);
        }
    }
}
