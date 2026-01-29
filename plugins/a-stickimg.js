const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const { writeExifImg } = require('../lib/exif');

module.exports = {
    command: 'stickimg',
    aliases: ['simg', 'imgtostick'],
    category: 'stickers',
    description: 'Convert image to sticker (images only)',
    usage: '.stickimg <packname> | <author> (reply to image)',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;

        try {
            const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg?.imageMessage) {
                await sock.sendMessage(chatId, { text: '⚠️ Please reply to an image!' }, { quoted: message });
                return;
            }

            const text = args.join(' ');
            let packname = 'My Pack';
            let author = 'Bot User';

            if (text.includes('|')) {
                const [pack, auth] = text.split('|').map(s => s.trim());
                packname = pack || packname;
                author = auth || author;
            }

            const stream = await downloadContentFromMessage(quotedMsg.imageMessage, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            const metadata = {
                packname: packname,
                author: author
            };

            const stickerPath = await writeExifImg(buffer, metadata);
            const stickerBuffer = fs.readFileSync(stickerPath);

            await sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: message });

            fs.unlinkSync(stickerPath);

        } catch (error) {
            console.error('Stickimg Error:', error);
            await sock.sendMessage(chatId, { text: `❌ Error: ${error.message}` }, { quoted: message });
        }
    }
};
