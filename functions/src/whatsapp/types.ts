// Incoming webhook payload types

export interface WAWebhookPayload {
    object: string;
    entry: WAEntry[];
}

export interface WAEntry {
    id: string;
    changes: WAChange[];
}

export interface WAChange {
    value: WAChangeValue;
    field: string;
}

export interface WAChangeValue {
    messaging_product: string;
    metadata: { display_phone_number: string; phone_number_id: string };
    contacts?: WAContact[];
    messages?: WAMessage[];
    statuses?: WAStatus[];
}

export interface WAContact {
    profile: { name: string };
    wa_id: string;
}

export interface WAMessage {
    from: string;
    id: string;
    timestamp: string;
    type: 'text' | 'interactive' | 'image' | 'document' | 'button';
    text?: { body: string };
    interactive?: {
        type: 'list_reply' | 'button_reply';
        list_reply?: { id: string; title: string };
        button_reply?: { id: string; title: string };
    };
}

export interface WAStatus {
    id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
    recipient_id: string;
}

// Outgoing message types

export interface ListSection {
    title: string;
    rows: ListRow[];
}

export interface ListRow {
    id: string;          // max 200 chars, used as callback data
    title: string;       // max 24 chars
    description?: string; // max 72 chars
}

export interface ReplyButton {
    id: string;   // max 256 chars
    title: string; // max 20 chars
}

export interface TemplateComponent {
    type: 'header' | 'body' | 'button';
    parameters?: TemplateParameter[];
    sub_type?: string;
    index?: number;
}

export interface TemplateParameter {
    type: 'text' | 'document' | 'image';
    text?: string;
    document?: { link: string; filename?: string };
    image?: { link: string };
}
