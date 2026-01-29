const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { imageToWebp, videoToWebp, writeExif } = require('../lib/exif');

module.exports = {
    command: 'sticker',
    aliases: ['stik', 's'],
    category: 'stickers',
    description: 'Convert an image or video into a sticker with custom metadata',
    usage: '.sticker <packname> | <author> (reply to image/video)',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;

        try {
            const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg) {
                await sock.sendMessage(chatId, { text: '⚠️ Please reply to an image or video!' }, { quoted: message });
                return;
            }

            const type = Object.keys(quotedMsg)[0];
            if (!['imageMessage', 'videoMessage'].includes(type)) {
                await sock.sendMessage(chatId, { text: '⚠️ Please reply to an image or video!' }, { quoted: message });
                return;
            }

            // Parse metadata from args
            const text = args.join(' ');
            let packname = 'My Stickers';
            let author = 'Bot';

            if (text.includes('|')) {
                const [pack, auth] = text.split('|').map(s => s.trim());
                packname = pack || packname;
                author = auth || author;
            } else if (text) {
                packname = text;
            }

            // Download media
            const stream = await downloadContentFromMessage(quotedMsg[type], type.split('Message')[0]);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            // Create sticker with EXIF
            const media = {
                data: buffer,
                mimetype: type === 'imageMessage' ? 'image/jpeg' : 'video/mp4'
            };

            const metadata = {
                packname: packname,
                author: author,
                categories: ['😀', '🎉']
            };

            await sock.sendMessage(chatId, { text: '⏳ Creating sticker...' }, { quoted: message });

            const stickerPath = await writeExif(media, metadata);
            const stickerBuffer = fs.readFileSync(stickerPath);

            await sock.sendMessage(chatId, { 
                sticker: stickerBuffer 
            }, { quoted: message });

            // Cleanup
            fs.unlinkSync(stickerPath);

        } catch (error) {
            console.error('Sticker Command Error:', error);
            await sock.sendMessage(chatId, { 
                text: `❌ Failed to create sticker!\n\nError: ${error.message}` 
            }, { quoted: message });
        }
    }
};
