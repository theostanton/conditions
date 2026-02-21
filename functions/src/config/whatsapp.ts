import {WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN, WA_VERIFY_TOKEN} from "@config/envs";

export const WA_API_VERSION = 'v21.0';
export const WA_API_BASE = `https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_NUMBER_ID}`;

export {WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN, WA_VERIFY_TOKEN};
