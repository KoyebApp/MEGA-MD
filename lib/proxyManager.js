
const fastgate = require('fastgate').default;
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

class ProxyManager {
    constructor() {
        this.proxyCache = new Map();
        this.cacheTTL = 5 * 60 * 1000;
    }

    async getUserLocation(userIp) {
        try {
            const response = await axios.get(`http://ip-api.com/json/${userIp}`, {
                timeout: 5000
            });
            
            return {
                country: response.data.countryCode || 'US',
                city: response.data.city || 'Unknown',
                isp: response.data.isp || 'Unknown'
            };
        } catch (error) {
            console.error('Location lookup failed:', error.message);
            return { country: 'PK', city: 'Karachi', isp: 'Unknown' };
        }
    }

    async getProxyForUser(userIp) {
        try {
            const location = await this.getUserLocation(userIp);
            
            // Try fastgate with user's country
            let response = await fastgate.getProxyList({
                country: [location.country.toLowerCase()],
                protocol: ['http'],
                anonymity: ['Elite'],
                timeout: 5000
            });

            // Fallback to any country
            if (!response.proxies || response.proxies.length === 0) {
                console.log(`No proxy for ${location.country}, trying any...`);
                response = await fastgate.getProxyList({
                    protocol: ['http'],
                    anonymity: ['Elite'],
                    timeout: 5000
                });
            }

            if (!response.proxies || response.proxies.length === 0) {
                console.log('No proxy available, will use direct connection');
                return null;
            }

            return response.proxies[0];

        } catch (error) {
            console.error('Proxy fetch failed:', error.message);
            return null;
        }
    }

    createHttpsAgent(proxy) {
        if (!proxy) return null;
        const proxyUrl = `http://${proxy.ip}:${proxy.port}`;
        return new HttpsProxyAgent(proxyUrl);
    }

    cleanCache() {
        const now = Date.now();
        for (const [key, value] of this.proxyCache.entries()) {
            if (now - value.timestamp > this.cacheTTL) {
                this.proxyCache.delete(key);
            }
        }
    }
}

const proxyManager = new ProxyManager();
setInterval(() => proxyManager.cleanCache(), 10 * 60 * 1000);

module.exports = proxyManager;
