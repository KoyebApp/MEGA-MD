const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { TelegraPh } = require('../lib/myfunc2');
const { fetchBuffer } = require('../lib/myfunc2');

module.exports = {
    command: 'telegraph',
    aliases: ['tgph', 'tg'],
    category: 'tools',
    description: 'Upload image/video to Telegraph and get link',
    usage: '.telegraph (reply to image/video)',
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
                await sock.sendMessage(chatId, { text: '⚠️ Only images and videos are supported!' }, { quoted: message });
                return;
            }

            await sock.sendMessage(chatId, { text: '⏳ Uploading to Telegraph...' }, { quoted: message });

            // Download media
            const stream = await downloadContentFromMessage(quotedMsg[type], type.split('Message')[0]);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            const tempDir = path.join('./temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const ext = type === 'imageMessage' ? 'jpg' : 'mp4';
            const tempPath = path.join(tempDir, `telegraph_${Date.now()}.${ext}`);

            fs.writeFileSync(tempPath, buffer);

            const url = await TelegraPh(tempPath);

            await sock.sendMessage(chatId, { 
                text: `✅ *Upload Successful!*\n\n🔗 URL: ${url}\n\n_Click the link to view your media_` 
            }, { quoted: message });

            fs.unlinkSync(tempPath);

        } catch (error) {
            console.error('Telegraph Error:', error);
            await sock.sendMessage(chatId, { text: `❌ Upload failed!\n\nError: ${error.message}` }, { quoted: message });
        }
    }
};
