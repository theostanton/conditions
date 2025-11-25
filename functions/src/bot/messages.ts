/**
 * Centralized message strings for the bot
 * All user-facing text should be defined here for easy management and localization
 */

export const BotMessages = {
    // Menu Headers (with HTML formatting)
    menuHeaders: {
        selectRange: "<b>Choose mountain range</b>",
        selectMassif: (mountain: string) => `<b>Choose massif in ${mountain}</b>`,
        download: (massifName: string) => `<b>Download conditions in ${massifName}</b>`,
        chooseContent: (massifName: string) => `<b>Choose content for ${massifName}</b>`,
        yourSubscriptions: (mountain: string) => `<b>Choose massif in ${mountain}</b>`,
    },

    // Prompts and Questions
    prompts: {
        mainMenu: "Do you want to get the current conditions or subscribe to them?",
    },

    // Status Messages
    status: {
        fetchingBulletin: (massifName: string) => `Fetching latest bulletin for ${massifName}...`,
        noBulletinAvailable: (massifName: string) => `Currently no bulletin available for ${massifName}`,
    },

    // Error Messages
    errors: {
        unableToIdentifyUser: "Unable to identify user",
        unableToIdentifyRecipient: "Unable to identify recipient",
        fetchBulletinFailed: (massifName: string) => `Failed to fetch bulletin for ${massifName}`,
        fetchBulletinRetry: (massifName: string) => `Failed to fetch bulletin for ${massifName}. Please try again.`,
        retrieveBulletinRetry: (massifName: string) => `Failed to retrieve bulletin for ${massifName}. Please try again.`,
        updateSubscriptionFailed: (massifName: string) => `Failed to update subscription for ${massifName}`,
        updateSubscriptionRetry: (massifName: string) => `Failed to update subscription for ${massifName}. Please try again.`,
        unsubscribeFailed: (massifName: string) => `Failed to unsubscribe from ${massifName}`,
        unsubscribeRetry: (massifName: string) => `Failed to unsubscribe from ${massifName}. Please try again.`,
    },

    // Parse mode constant for HTML-formatted messages
    parseMode: "HTML" as const,
} as const;
