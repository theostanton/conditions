import {Bot, Context, InlineKeyboard} from "grammy";
import {MassifCache} from "@cache/MassifCache";
import {Subscriptions} from "@database/models/Subscriptions";
import {ActionSubscriptions} from "@bot/actions/subscriptions";
import {ContentTypes, Massif} from "@app-types";
import {CONTENT_TYPE_CONFIGS} from "@constants/contentTypes";
import {BotMessages} from "@bot/messages";
import {Analytics} from "@analytics/Analytics";

// Store temporary content type selections for managing subscriptions
const managementSelections = new Map<string, Partial<ContentTypes>>();

function getManagementKey(userId: number, massifCode: number): string {
    return `manage:${userId}:${massifCode}`;
}

/**
 * Handle "Subscribe" button clicks from download deliveries
 */
async function handleSubscribeCallback(ctx: Context): Promise<void> {
    if (!ctx.callbackQuery?.data || !ctx.from?.id) {
        return;
    }

    const massifCode = parseInt(ctx.callbackQuery.data.split(':')[1]);
    const massif = MassifCache.findByCode(massifCode);

    if (!massif) {
        await ctx.answerCallbackQuery({text: 'Massif not found', show_alert: true});
        return;
    }

    try {
        // Check if already subscribed
        const isSubscribed = await Subscriptions.isSubscribed(ctx.from.id.toString(), massifCode);

        if (isSubscribed) {
            await ctx.answerCallbackQuery({
                text: `You're already subscribed to ${massif.name}!`,
                show_alert: true
            });
            return;
        }

        // Show content type selection menu
        await showContentTypeSelection(ctx, massif);

        await ctx.answerCallbackQuery();
    } catch (error) {
        console.error('Error handling subscribe callback:', error);
        await ctx.answerCallbackQuery({
            text: 'Failed to process subscription. Please try again.',
            show_alert: true
        });
    }
}

/**
 * Handle "Manage Subscription" button clicks from subscription deliveries
 */
async function handleManageSubscriptionCallback(ctx: Context): Promise<void> {
    if (!ctx.callbackQuery?.data || !ctx.from?.id) {
        return;
    }

    const massifCode = parseInt(ctx.callbackQuery.data.split(':')[1]);
    const massif = MassifCache.findByCode(massifCode);

    if (!massif) {
        await ctx.answerCallbackQuery({text: 'Massif not found', show_alert: true});
        return;
    }

    try {
        // Get current subscription
        const subscription = await Subscriptions.getSubscription(ctx.from.id.toString(), massifCode);

        if (!subscription) {
            await ctx.answerCallbackQuery({
                text: `You're not subscribed to ${massif.name}`,
                show_alert: true
            });
            return;
        }

        // Initialize management selections with current subscription
        const key = getManagementKey(ctx.from.id, massifCode);
        managementSelections.set(key, {
            bulletin: subscription.bulletin,
            snow_report: subscription.snow_report,
            fresh_snow: subscription.fresh_snow,
            weather: subscription.weather,
            last_7_days: subscription.last_7_days,
            rose_pentes: subscription.rose_pentes,
            montagne_risques: subscription.montagne_risques,
        });

        // Show management menu
        await showManagementMenu(ctx, massif);

        await ctx.answerCallbackQuery();
    } catch (error) {
        console.error('Error handling manage subscription callback:', error);
        await ctx.answerCallbackQuery({
            text: 'Failed to load subscription settings. Please try again.',
            show_alert: true
        });
    }
}

/**
 * Show content type selection for new subscriptions
 */
async function showContentTypeSelection(ctx: Context, massif: Massif): Promise<void> {
    if (!ctx.from?.id) return;

    // Initialize with default settings
    ActionSubscriptions.initializeContentTypes(ctx.from.id, massif);

    const keyboard = buildContentTypeKeyboard(massif, ActionSubscriptions.getContentTypes(ctx.from.id, massif), false);

    try {
        // Send a new message with the selection menu instead of editing the document
        await ctx.reply(BotMessages.menuHeaders.chooseContent(massif.name), {
            reply_markup: keyboard,
            parse_mode: BotMessages.parseMode
        });
    } catch (error) {
        console.error('Error showing content selection:', error);
    }
}

/**
 * Show management menu for existing subscriptions
 */
async function showManagementMenu(ctx: Context, massif: Massif): Promise<void> {
    if (!ctx.from?.id) return;

    const key = getManagementKey(ctx.from.id, massif.code);
    const contentTypes = managementSelections.get(key) || {};

    const keyboard = buildContentTypeKeyboard(massif, contentTypes, true);

    try {
        // Send a new message with the management menu instead of editing the document
        await ctx.reply(`⚙️ Manage subscription for *${massif.name}*\n\nSelect the content you want to receive:`, {
            reply_markup: keyboard,
            parse_mode: BotMessages.parseMode
        });
    } catch (error) {
        console.error('Error showing management menu:', error);
    }
}

/**
 * Build inline keyboard for content type selection
 */
function buildContentTypeKeyboard(massif: Massif, contentTypes: Partial<ContentTypes>, isManagement: boolean): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    // Add toggle buttons for each content type
    for (const config of CONTENT_TYPE_CONFIGS) {
        const isChecked = contentTypes[config.key] || false;
        const label = isChecked ? `☑️ ${config.emoji} ${config.label}` : `◻ ${config.emoji} ${config.label}`;
        const callbackData = isManagement
            ? `manage_toggle:${massif.code}:${config.key}`
            : `subscribe_toggle:${massif.code}:${config.key}`;

        keyboard.text(label, callbackData).row();
    }

    // Add Save and Cancel buttons
    const saveCallback = isManagement ? `manage_save:${massif.code}` : `subscribe_save:${massif.code}`;
    const cancelCallback = isManagement ? `manage_cancel:${massif.code}` : `subscribe_cancel:${massif.code}`;

    keyboard.text('✅ Subscribe', saveCallback);
    keyboard.text('❌ Cancel', cancelCallback);

    // Add Unsubscribe button for management (on a new row)
    if (isManagement) {
        keyboard.row();
        keyboard.text('🗑️ Unsubscribe', `manage_unsubscribe:${massif.code}`);
    }

    return keyboard;
}

/**
 * Handle toggle actions for subscription content types
 */
async function handleSubscribeToggle(ctx: Context): Promise<void> {
    if (!ctx.callbackQuery?.data || !ctx.from?.id) return;

    const [, massifCode, contentType] = ctx.callbackQuery.data.split(':');
    const massif = MassifCache.findByCode(parseInt(massifCode));

    if (!massif) return;

    // Toggle the content type
    ActionSubscriptions.toggleContentType(ctx.from.id, massif, contentType as keyof ContentTypes);

    // Update the keyboard
    const keyboard = buildContentTypeKeyboard(
        massif,
        ActionSubscriptions.getContentTypes(ctx.from.id, massif),
        false
    );

    try {
        await ctx.editMessageReplyMarkup({reply_markup: keyboard});
        await ctx.answerCallbackQuery();
    } catch (error) {
        console.error('Error updating keyboard:', error);
    }
}

/**
 * Handle toggle actions for management content types
 */
async function handleManageToggle(ctx: Context): Promise<void> {
    if (!ctx.callbackQuery?.data || !ctx.from?.id) return;

    const [, massifCode, contentType] = ctx.callbackQuery.data.split(':');
    const massif = MassifCache.findByCode(parseInt(massifCode));

    if (!massif) return;

    const key = getManagementKey(ctx.from.id, massif.code);
    const current = managementSelections.get(key) || {};
    current[contentType as keyof ContentTypes] = !current[contentType as keyof ContentTypes];
    managementSelections.set(key, current);

    // Update the keyboard
    const keyboard = buildContentTypeKeyboard(massif, current, true);

    try {
        await ctx.editMessageReplyMarkup({reply_markup: keyboard});
        await ctx.answerCallbackQuery();
    } catch (error) {
        console.error('Error updating keyboard:', error);
    }
}

/**
 * Handle save action for new subscriptions
 */
async function handleSubscribeSave(ctx: Context): Promise<void> {
    if (!ctx.callbackQuery?.data || !ctx.from?.id) return;

    const massifCode = parseInt(ctx.callbackQuery.data.split(':')[1]);
    const massif = MassifCache.findByCode(massifCode);

    if (!massif) {
        await ctx.answerCallbackQuery({text: 'Massif not found', show_alert: true});
        return;
    }

    try {
        const contentTypes = ActionSubscriptions.getContentTypes(ctx.from.id, massif);

        // Subscribe with selected content types
        await Subscriptions.subscribe(ctx.from.id.toString(), massif, contentTypes);

        // Clear temporary selection
        ActionSubscriptions.clearContentTypes(ctx.from.id, massif);

        // Update the message to show success (combine text and markup updates)
        await ctx.editMessageText(`✅ Subscribed to ${massif.name}`, {
            parse_mode: BotMessages.parseMode,
            reply_markup: undefined
        });

        await ctx.answerCallbackQuery({text: 'Subscription saved!'});

        // Analytics
        Analytics.send(`${ctx.from.id} subscribed to ${massif.name} via callback with content types: ${JSON.stringify(contentTypes)}`).catch(err =>
            console.error('Analytics error:', err)
        );
    } catch (error) {
        console.error('Error saving subscription:', error);
        await ctx.answerCallbackQuery({
            text: 'Failed to save subscription. Please try again.',
            show_alert: true
        });
    }
}

/**
 * Handle save action for subscription management
 */
async function handleManageSave(ctx: Context): Promise<void> {
    if (!ctx.callbackQuery?.data || !ctx.from?.id) return;

    const massifCode = parseInt(ctx.callbackQuery.data.split(':')[1]);
    const massif = MassifCache.findByCode(massifCode);

    if (!massif) {
        await ctx.answerCallbackQuery({text: 'Massif not found', show_alert: true});
        return;
    }

    try {
        const key = getManagementKey(ctx.from.id, massif.code);
        const contentTypes = managementSelections.get(key) || {};

        // Update subscription with new content types
        await Subscriptions.updateContentTypes(ctx.from.id.toString(), massif.code, contentTypes);

        // Clear temporary selection
        managementSelections.delete(key);

        // Update the message to show success (combine text and markup updates)
        await ctx.editMessageText(`✅ Subscription updated for ${massif.name}!\n\nYour content preferences have been saved.`, {
            parse_mode: BotMessages.parseMode,
            reply_markup: undefined
        });

        await ctx.answerCallbackQuery({text: 'Subscription updated!'});

        // Analytics
        Analytics.send(`${ctx.from.id} updated subscription for ${massif.name} with content types: ${JSON.stringify(contentTypes)}`).catch(err =>
            console.error('Analytics error:', err)
        );
    } catch (error) {
        console.error('Error updating subscription:', error);
        await ctx.answerCallbackQuery({
            text: 'Failed to update subscription. Please try again.',
            show_alert: true
        });
    }
}

/**
 * Handle unsubscribe action from management menu
 */
async function handleManageUnsubscribe(ctx: Context): Promise<void> {
    if (!ctx.callbackQuery?.data || !ctx.from?.id) return;

    const massifCode = parseInt(ctx.callbackQuery.data.split(':')[1]);
    const massif = MassifCache.findByCode(massifCode);

    if (!massif) {
        await ctx.answerCallbackQuery({text: 'Massif not found', show_alert: true});
        return;
    }

    try {
        // Unsubscribe from the massif
        await Subscriptions.unsubscribe(ctx.from.id.toString(), massif);

        // Clear temporary selection
        const key = getManagementKey(ctx.from.id, massif.code);
        managementSelections.delete(key);

        // Update the message to show success
        await ctx.editMessageText(`🗑️ Unsubscribed from ${massif.name}.`, {
            parse_mode: BotMessages.parseMode,
            reply_markup: undefined
        });

        await ctx.answerCallbackQuery({text: 'Unsubscribed successfully'});

        // Analytics
        Analytics.send(`${ctx.from.id} unsubscribed from ${massif.name} via management menu`).catch(err =>
            console.error('Analytics error:', err)
        );
    } catch (error) {
        console.error('Error unsubscribing:', error);
        await ctx.answerCallbackQuery({
            text: 'Failed to unsubscribe. Please try again.',
            show_alert: true
        });
    }
}

/**
 * Handle cancel action
 */
async function handleCancel(ctx: Context): Promise<void> {
    if (!ctx.callbackQuery?.data || !ctx.from?.id) return;

    const [action, massifCode] = ctx.callbackQuery.data.split(':');
    const isManagement = action.startsWith('manage_');

    if (isManagement) {
        const key = getManagementKey(ctx.from.id, parseInt(massifCode));
        managementSelections.delete(key);
    } else {
        const massif = MassifCache.findByCode(parseInt(massifCode));
        if (massif) {
            ActionSubscriptions.clearContentTypes(ctx.from.id, massif);
        }
    }

    // Delete the menu message
    try {
        await ctx.deleteMessage();
    } catch (error) {
        // If we can't delete, just update the message
        await ctx.editMessageText('Cancelled', {
            reply_markup: undefined
        }).catch(() => {
        });
    }

    await ctx.answerCallbackQuery({text: 'Cancelled'});
}

/**
 * Register all subscription-related callback handlers with the bot
 */
export function registerSubscriptionCallbacks(bot: Bot): void {
    // Main action callbacks
    bot.callbackQuery(/^subscribe:\d+$/, handleSubscribeCallback);
    bot.callbackQuery(/^manage_subscription:\d+$/, handleManageSubscriptionCallback);

    // Toggle callbacks
    bot.callbackQuery(/^subscribe_toggle:\d+:\w+$/, handleSubscribeToggle);
    bot.callbackQuery(/^manage_toggle:\d+:\w+$/, handleManageToggle);

    // Save callbacks
    bot.callbackQuery(/^subscribe_save:\d+$/, handleSubscribeSave);
    bot.callbackQuery(/^manage_save:\d+$/, handleManageSave);

    // Unsubscribe callback
    bot.callbackQuery(/^manage_unsubscribe:\d+$/, handleManageUnsubscribe);

    // Cancel callbacks
    bot.callbackQuery(/^subscribe_cancel:\d+$/, handleCancel);
    bot.callbackQuery(/^manage_cancel:\d+$/, handleCancel);
}
