const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const { imageToWebp, videoToWebp } = require('../lib/exif');

module.exports = {
    command: 'take',
    aliases: ['takestick', 'steal'],
    category: 'stickers',
    description: 'Take/steal a sticker and add your own metadata',
    usage: '.take <packname> | <author> (reply to sticker)',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;

        try {
            const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg?.stickerMessage) {
                await sock.sendMessage(chatId, { text: '⚠️ Please reply to a sticker!' }, { quoted: message });
                return;
            }

            const text = args.join(' ');
            if (!text) {
                await sock.sendMessage(chatId, { text: '⚠️ Usage: .take <packname> | <author>' }, { quoted: message });
                return;
            }

            let packname = 'Stolen Pack';
            let author = 'Me';

            if (text.includes('|')) {
                const [pack, auth] = text.split('|').map(s => s.trim());
                packname = pack || packname;
                author = auth || author;
            } else {
                packname = text;
            }

            const stream = await downloadContentFromMessage(quotedMsg.stickerMessage, 'sticker');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            const media = {
                data: buffer,
                mimetype: 'image/webp'
            };

            const metadata = {
                packname: packname,
                author: author
            };

            const { writeExif } = require('../lib/exif');
            const stickerPath = await writeExif(media, metadata);
            const stickerBuffer = fs.readFileSync(stickerPath);

            await sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: message });

            fs.unlinkSync(stickerPath);

        } catch (error) {
            console.error('Take Error:', error);
            await sock.sendMessage(chatId, { text: `❌ Error: ${error.message}` }, { quoted: message });
        }
    }
};
