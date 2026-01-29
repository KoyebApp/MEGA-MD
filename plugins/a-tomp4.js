const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { webp2mp4File } = require('../lib/myfunc2');

module.exports = {
    command: 'tomp4',
    aliases: ['tovideo', 'webptomp4'],
    category: 'converter',
    description: 'Convert WebP sticker to MP4 video',
    usage: '.tomp4 (reply to sticker)',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;

        try {
            const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg?.stickerMessage) {
                await sock.sendMessage(chatId, { text: '⚠️ Please reply to an animated sticker!' }, { quoted: message });
                return;
            }

            await sock.sendMessage(chatId, { text: '⏳ Converting sticker to video...' }, { quoted: message });

            const stream = await downloadContentFromMessage(quotedMsg.stickerMessage, 'sticker');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            const tempDir = path.join('./temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const tempPath = path.join(tempDir, `sticker_${Date.now()}.webp`);
            fs.writeFileSync(tempPath, buffer);

            const result = await webp2mp4File(tempPath);

            if (!result.status) {
                throw new Error('Conversion failed');
            }

            await sock.sendMessage(chatId, {
                video: { url: result.result },
                caption: '✅ *Converted to MP4!*',
                gifPlayback: true
            }, { quoted: message });

            fs.unlinkSync(tempPath);

        } catch (error) {
            console.error('ToMP4 Error:', error);
            await sock.sendMessage(chatId, { text: `❌ Conversion failed!\n\nError: ${error.message}` }, { quoted: message });
        }
    }
};
