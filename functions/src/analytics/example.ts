import { Analytics } from '@analytics/Analytics';

/**
 * This file demonstrates how to use the Analytics.send function
 *
 * You can delete this file once you're familiar with the API
 */

// Example 1: Simple message
async function example1() {
    await Analytics.send('User completed registration');
}

// Example 2: Message with metadata
async function example2() {
    await Analytics.send('New subscription created', {
        massifId: 'ALPES',
        userId: 123456789,
        timestamp: Date.now()
    });
}

// Example 3: Error notification
async function example3() {
    try {
        // Some code that might fail
        throw new Error('Database connection failed');
    } catch (error) {
        await Analytics.sendError(error as Error, 'User registration flow');
    }
}

// Example 4: Custom event tracking
async function example4() {
    await Analytics.send('Bulletin fetched successfully', {
        massifName: 'Haute-Maurienne',
        bulletinDate: new Date().toISOString(),
        deliveryMethod: 'on-demand'
    });
}
