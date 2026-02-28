import axios from "axios";
import {Agent} from "https";
import {WA_API_BASE, WA_ACCESS_TOKEN} from "@config/whatsapp";
import type {ListSection, ReplyButton, TemplateComponent} from "@whatsapp/types";

const keepAliveAgent = new Agent({keepAlive: true});

const api = axios.create({
    baseURL: WA_API_BASE,
    headers: {
        'Authorization': `Bearer ${WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
    },
    httpsAgent: keepAliveAgent,
    timeout: 15000,
});

api.interceptors.response.use(
    response => response,
    error => {
        if (error.response) {
            console.error(`WhatsApp API ${error.response.status}:`, JSON.stringify(error.response.data));
        }
        return Promise.reject(error);
    },
);

export namespace WhatsAppClient {

    export async function sendText(to: string, body: string): Promise<void> {
        await api.post('/messages', {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: {body},
        });
    }

    export async function sendDocument(to: string, documentUrl: string, caption?: string, filename?: string): Promise<void> {
        await api.post('/messages', {
            messaging_product: 'whatsapp',
            to,
            type: 'document',
            document: {
                link: documentUrl,
                ...(caption && {caption}),
                ...(filename && {filename}),
            },
        });
    }

    export async function sendImage(to: string, imageSource: { url: string } | { id: string }, caption?: string): Promise<void> {
        const image: Record<string, string> = {};
        if ('url' in imageSource) {
            image.link = imageSource.url;
        } else {
            image.id = imageSource.id;
        }
        if (caption) {
            image.caption = caption;
        }

        await api.post('/messages', {
            messaging_product: 'whatsapp',
            to,
            type: 'image',
            image,
        });
    }

    export async function sendListMessage(
        to: string,
        body: string,
        buttonText: string,
        sections: ListSection[],
        header?: string,
    ): Promise<void> {
        await api.post('/messages', {
            messaging_product: 'whatsapp',
            to,
            type: 'interactive',
            interactive: {
                type: 'list',
                ...(header && {header: {type: 'text', text: header}}),
                body: {text: body},
                action: {
                    button: buttonText,
                    sections,
                },
            },
        });
    }

    export async function sendReplyButtons(
        to: string,
        body: string,
        buttons: ReplyButton[],
    ): Promise<void> {
        await api.post('/messages', {
            messaging_product: 'whatsapp',
            to,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {text: body},
                action: {
                    buttons: buttons.map(b => ({
                        type: 'reply',
                        reply: {id: b.id, title: b.title},
                    })),
                },
            },
        });
    }

    export async function sendTemplate(
        to: string,
        templateName: string,
        languageCode: string,
        components: TemplateComponent[],
    ): Promise<void> {
        await api.post('/messages', {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
                name: templateName,
                language: {code: languageCode},
                components,
            },
        });
    }

    export async function uploadMedia(buffer: Buffer, mimeType: string, filename?: string): Promise<string> {
        const form = new FormData();
        form.append('file', new Blob([buffer], {type: mimeType}), filename || 'file');
        form.append('messaging_product', 'whatsapp');
        form.append('type', mimeType);

        const response = await axios.post(`${WA_API_BASE}/media`, form, {
            headers: {
                'Authorization': `Bearer ${WA_ACCESS_TOKEN}`,
            },
        });

        return response.data.id;
    }

    export async function react(to: string, messageId: string, emoji: string): Promise<void> {
        await api.post('/messages', {
            messaging_product: 'whatsapp',
            to,
            type: 'reaction',
            reaction: {
                message_id: messageId,
                emoji,
            },
        });
    }

    export async function markAsRead(messageId: string): Promise<void> {
        await api.post('/messages', {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
        });
    }
}
