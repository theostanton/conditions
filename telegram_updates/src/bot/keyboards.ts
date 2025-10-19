import { Context, Keyboard } from "grammy";
import { getRecipientMassifs } from '../database/operations';

export async function buildUnsubscribeKeyboard(context: Context): Promise<Keyboard | undefined> {
    const recipientMassifs = await getRecipientMassifs(context.from?.id as number);

    if (recipientMassifs.length === 0) {
        await context.reply("You are not subscribed to any BRAs");
        return;
    }

    const keyboard = new Keyboard();

    keyboard.text(`/unsubscribe all`).row();
    recipientMassifs.forEach(massif => {
        keyboard.text(`/unsubscribe ${massif.name}`).row();
    });

    keyboard.resized(false);
    return keyboard;
}
