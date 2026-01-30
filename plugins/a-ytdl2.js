const ytdl = require('ytdl-core');
const proxyManager = require('../lib/proxyManager');

module.exports = {
    command: 'ytdl2',
    aliases: ['yt2', 'youtube2'],
    category: 'downloader',
    description: 'Download YouTube video (works for EVERYONE)',
    usage: '.ytdl2 <youtube_url>',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;

        try {
            const url = args[0];
            if (!url || !ytdl.validateURL(url)) {
                await sock.sendMessage(chatId, { 
                    text: '⚠️ Please provide a valid YouTube URL!' 
                }, { quoted: message });
                return;
            }

            await sock.sendMessage(chatId, { 
                text: '⏳ Detecting your location...' 
            }, { quoted: message });

            // Extract user IP from WhatsApp connection
            // In production, get this from your server's connection metadata
            const userIp = context.userIp || '8.8.8.8'; // Fallback

            // Get user's location
            const location = await proxyManager.getUserLocation(userIp);

            await sock.sendMessage(chatId, { 
                text: `📍 Location: ${location.city}, ${location.country}\n⏳ Finding optimal proxy...` 
            }, { quoted: message });

            // Get proxy for user
            const proxy = await proxyManager.getProxyForUser(userIp);

            if (!proxy) {
                throw new Error('No proxy available. Try again later.');
            }

            await sock.sendMessage(chatId, { 
                text: `🔄 Using proxy: ${proxy.country.toUpperCase()}\n⏳ Fetching video...` 
            }, { quoted: message });

            // Create proxy agent
            const agent = proxyManager.createHttpsAgent(proxy);

            // Get video info through proxy
            const info = await ytdl.getInfo(url, {
                requestOptions: {
                    agent: agent,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                }
            });

            const title = info.videoDetails.title;
            const duration = info.videoDetails.lengthSeconds;

            // Get best format
            const format = ytdl.chooseFormat(info.formats, { 
                quality: 'highest',
                filter: 'videoandaudio'
            });

            await sock.sendMessage(chatId, {
                text: `📹 *${title}*\n\n` +
                      `⏱️ Duration: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}\n` +
                      `📊 Quality: ${format.qualityLabel}\n` +
                      `🌍 Via: ${proxy.country.toUpperCase()}\n` +
                      `🔗 Your IP: ${location.country}\n\n` +
                      `⏳ Downloading...`
            }, { quoted: message });

            // Download video through proxy
            const stream = ytdl.downloadFromInfo(info, {
                format: format,
                requestOptions: {
                    agent: agent,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                }
            });

            const chunks = [];
            let downloadedBytes = 0;
            const totalBytes = parseInt(format.contentLength || 0);

            stream.on('data', chunk => {
                chunks.push(chunk);
                downloadedBytes += chunk.length;
                
                // Progress update every 10%
                const progress = Math.floor((downloadedBytes / totalBytes) * 100);
                if (progress % 10 === 0) {
                    console.log(`Download progress: ${progress}%`);
                }
            });

            stream.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                
                await sock.sendMessage(chatId, {
                    video: buffer,
                    caption: `✅ *${title}*\n\n🌍 Downloaded via ${proxy.country.toUpperCase()} proxy`,
                    fileName: `${title}.mp4`
                }, { quoted: message });
            });

            stream.on('error', (error) => {
                throw error;
            });

        } catch (error) {
            console.error('YouTube Download Error:', error);
            await sock.sendMessage(chatId, { 
                text: `❌ Download failed!\n\nError: ${error.message}` 
            }, { quoted: message });
        }
    }
};


