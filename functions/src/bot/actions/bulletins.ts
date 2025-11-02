import {Context} from "grammy";
import {Bulletins} from "@database/models/Bulletins";
import {Massif} from "@app-types";

export namespace ActionBulletins {

    export async function send(context: Context, massif: Massif): Promise<void> {
        try {
            const bulletin = await Bulletins.getLatest(massif.code);

            if (bulletin === undefined) {
                await context.reply(`No bulletin for ${massif.name}`);
            } else if (bulletin.valid_to < new Date()) {
                await context.replyWithDocument(bulletin.public_url);
                await context.reply(`Latest bulletin for ${massif.name} is outdated`);
            } else {
                await context.replyWithDocument(bulletin.public_url);
            }
        } catch (error) {
            console.error('Error sending bulletin:', error);
            await context.reply(`Failed to retrieve bulletin for ${massif.name}. Please try again.`);
        }
    }
}
