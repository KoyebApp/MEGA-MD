const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { buffergif } = require('../lib/myfunc2');

module.exports = {
    command: 'giftomp4',
    aliases: ['togif', 'gif2mp4'],
    category: 'converter',
    description: 'Convert GIF to MP4 video',
    usage: '.giftomp4 (reply to GIF)',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;

        try {
            const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg?.videoMessage && !quotedMsg?.imageMessage) {
                await sock.sendMessage(chatId, { text: '⚠️ Please reply to a GIF!' }, { quoted: message });
                return;
            }

            // Check if it's actually a GIF
            const msg = quotedMsg.videoMessage || quotedMsg.imageMessage;
            if (!msg.mimetype?.includes('gif')) {
                await sock.sendMessage(chatId, { text: '⚠️ This is not a GIF!' }, { quoted: message });
                return;
            }

            await sock.sendMessage(chatId, { text: '⏳ Converting GIF to MP4...' }, { quoted: message });

            const stream = await downloadContentFromMessage(msg, quotedMsg.videoMessage ? 'video' : 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            const mp4Buffer = await buffergif(buffer);

            await sock.sendMessage(chatId, {
                video: mp4Buffer,
                caption: '✅ *GIF converted to MP4!*',
                gifPlayback: true
            }, { quoted: message });

        } catch (error) {
            console.error('GifToMP4 Error:', error);
            await sock.sendMessage(chatId, { text: `❌ Conversion failed!\n\nError: ${error.message}` }, { quoted: message });
        }
    }
};
