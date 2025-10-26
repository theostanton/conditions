# API Requests

HTTP request files for testing and interacting with the external APIs used by this project.

## Files

- **meteofrance.http** - Meteo France API requests for avalanche bulletins
- **telegram.http** - Telegram Bot API requests for webhook and bot management
- **whatsapp.http** - WhatsApp Business API requests (Facebook Graph API)
- **gcloud.http** - Google Cloud Platform requests (Cloud Functions, Cloud Storage)
- **http-client.private.env.json** - Environment variables (private, not committed)

## Setup

1. Copy the environment variables template and fill in your credentials:
   ```bash
   cp http-client.private.env.json.example http-client.private.env.json
   ```

2. Update the values in `http-client.private.env.json`:
   - `telegram_bot_token` - Your Telegram bot token
   - `meteofrance_api_key` - Your Meteo France API key (JWT)
   - `gcloud_identity_token` - Get with `gcloud auth print-identity-token`
   - `whatsapp_access_token` - Your WhatsApp/Facebook access token
   - `test_chat_id` - Your Telegram chat ID for testing
   - `recipient_phone_number` - WhatsApp number for testing

## Usage

These files are compatible with:
- **JetBrains IDEs** (IntelliJ IDEA, WebStorm, etc.) - Use the built-in HTTP Client
- **VS Code** - Install the REST Client extension
- **Any HTTP client** - Copy the requests to Postman, Insomnia, etc.

### Running Requests

In JetBrains IDEs or VS Code with REST Client:
1. Open any `.http` file
2. Click the "Run" button next to a request
3. Variables from `http-client.private.env.json` will be automatically substituted

### Environment Variables

The `http-client.private.env.json` file uses the `dev` environment. Variables are referenced in requests using `{{variable_name}}`.

## API Documentation

- [Meteo France API](https://portail-api.meteofrance.fr/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Google Cloud Functions](https://cloud.google.com/functions/docs)

## Security

**IMPORTANT:** The `http-client.private.env.json` file contains sensitive credentials and should NEVER be committed to version control. It is already in `.gitignore`.
