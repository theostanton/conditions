import {config} from "dotenv";
config();

const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;

if (!WA_PHONE_NUMBER_ID || !WA_ACCESS_TOKEN) {
    console.error("Missing WA_PHONE_NUMBER_ID or WA_ACCESS_TOKEN in .env");
    process.exit(1);
}

const TO = process.argv[2];
if (!TO) {
    console.error("Usage: tsx test-template.ts <phone_number>");
    process.exit(1);
}

const API_URL = `https://graph.facebook.com/v21.0/${WA_PHONE_NUMBER_ID}/messages`;

const body = {
    messaging_product: "whatsapp",
    to: TO,
    type: "template",
    template: {
        name: "bulletin",
        language: {code: "en"},
        components: [
            {
                type: "header",
                parameters: [{
                    type: "document",
                    document: {
                        link: "https://storage.googleapis.com/conditions-450312-bras/Vanoise-202511041800.pdf",
                        filename: "test-bulletin.pdf",
                    },
                }],
            },
            {
                type: "body",
                parameters: [{
                    type: "text",
                    parameter_name: "text",
                    text: "for Mont-Blanc • 28th Feb • 3 ",
                }],
            },
        ],
    },
};

console.log("Sending:\n" + JSON.stringify(body, null, 2));

fetch(API_URL, {
    method: "POST",
    headers: {
        "Authorization": `Bearer ${WA_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
})
    .then(async res => {
        const data = await res.json();
        if (res.ok) {
            console.log("\n✅ Sent:", JSON.stringify(data, null, 2));
        } else {
            console.error("\n❌ Failed:", JSON.stringify(data, null, 2));
        }
    })
    .catch(err => {
        console.error("\n❌ Request error:", err);
        process.exit(1);
    });
