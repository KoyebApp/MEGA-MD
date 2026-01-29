const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const { writeExifVid } = require('../lib/exif');

module.exports = {
    command: 'stickvid',
    aliases: ['svid', 'vidtostick', 'vstick'],
    category: 'stickers',
    description: 'Convert video to animated sticker (videos only, max 5 seconds)',
    usage: '.stickvid <packname> | <author> (reply to video)',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;

        try {
            const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg?.videoMessage) {
                await sock.sendMessage(chatId, { text: '⚠️ Please reply to a video!' }, { quoted: message });
                return;
            }

            const text = args.join(' ');
            let packname = 'Animated Stickers';
            let author = 'Bot Creator';

            if (text.includes('|')) {
                const [pack, auth] = text.split('|').map(s => s.trim());
                packname = pack || packname;
                author = auth || author;
            }

            await sock.sendMessage(chatId, { text: '⏳ Processing video (this may take a moment)...' }, { quoted: message });

            const stream = await downloadContentFromMessage(quotedMsg.videoMessage, 'video');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            const metadata = {
                packname: packname,
                author: author,
                categories: ['🎬', '🎥']
            };

            const stickerPath = await writeExifVid(buffer, metadata);
            const stickerBuffer = fs.readFileSync(stickerPath);

            await sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: message });

            fs.unlinkSync(stickerPath);

        } catch (error) {
            console.error('Stickvid Error:', error);
            await sock.sendMessage(chatId, { text: `❌ Error: ${error.message}` }, { quoted: message });
        }
    }
};
