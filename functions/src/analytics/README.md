# Analytics Module

The Analytics module provides a simple way to send notifications and track events by sending messages to your Telegram chat.

## Setup

1. Add your Telegram chat ID to the environment variables:
   ```bash
   ADMIN_CHAT_ID=your_chat_id_here
   ```

   To find your chat ID:
   - Message your bot
   - Check the bot logs or use `getUpdates` API
   - Your user ID will be in the `from.id` field

2. Import the Analytics module:
   ```typescript
   import { Analytics } from '@analytics/Analytics';
   ```

## Usage

### Basic Event Tracking

Send a simple notification:

```typescript
await Analytics.send('User completed registration');
```

### Event Tracking with Metadata

Send a notification with additional context:

```typescript
await Analytics.send('New subscription created', {
    massifCode: 12,
    userId: 123456789,
    timestamp: Date.now()
});
```

### Error Tracking

Track errors with context and stack traces:

```typescript
try {
    // Your code here
    throw new Error('Database connection failed');
} catch (error) {
    await Analytics.sendError(error as Error, 'User registration flow');
}
```

## Message Format

Messages sent via `Analytics.send()` will appear in your Telegram chat in this format:

```
📊 Analytics Event

Your message here

Metadata:
• key1: value1
• key2: value2

Time: 2025-01-03T12:00:00.000Z
```

Error messages sent via `Analytics.sendError()` will appear as:

```
🚨 Error Alert

Error message here

Context: Where the error occurred

Stack trace:
Error stack trace...

Time: 2025-01-03T12:00:00.000Z
```

## Examples

See `example.ts` for more detailed usage examples.

## Notes

- Analytics failures are caught and logged to console - they won't break your application
- All times are in ISO 8601 format (UTC)
- Metadata values are JSON stringified for display
- Error stack traces are truncated to 500 characters to avoid message length limits
