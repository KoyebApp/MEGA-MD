
const fastgate = require('fastgate');
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const axios = require('axios'); // Use axios instead of nyro for simple requests

class ProxyManager {
    constructor() {
        this.proxyCache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    }

    // Get user's geolocation from IP
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
            console.error('Failed to get user location:', error.message);
            return { country: 'US', city: 'Unknown', isp: 'Unknown' };
        }
    }

    // Get proxy matching user's location
    async getProxyForUser(userIp, options = {}) {
        const cacheKey = `${userIp}_${JSON.stringify(options)}`;
        
        // Check cache
        if (this.proxyCache.has(cacheKey)) {
            const cached = this.proxyCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTTL) {
                return cached.proxy;
            }
        }

        try {
            // Get user location
            const location = await this.getUserLocation(userIp);
            
            // Get proxy list from user's country
            let proxyResponse = await fastgate.getProxyList({
                country: [location.country.toLowerCase()],
                protocol: ['http', 'https'],
                anonymity: ['Elite', 'Anonymous'],
                timeout: 5000
            });

            // If no proxies in user's country, get any working proxy
            if (!proxyResponse.proxies || proxyResponse.proxies.length === 0) {
                console.log(`No proxy for ${location.country}, trying any country...`);
                proxyResponse = await fastgate.getProxyList({
                    protocol: ['http', 'https'],
                    anonymity: ['Elite', 'Anonymous'],
                    timeout: 5000
                });
            }

            if (!proxyResponse.proxies || proxyResponse.proxies.length === 0) {
                throw new Error('No working proxy available');
            }

            // Pick first alive proxy
            const proxy = proxyResponse.proxies[0];

            // Cache the proxy
            this.proxyCache.set(cacheKey, {
                proxy,
                timestamp: Date.now()
            });

            return proxy;

        } catch (error) {
            console.error('Failed to get proxy:', error.message);
            return null;
        }
    }

    // Create HTTP proxy agent
    createHttpAgent(proxy) {
        if (!proxy) return null;
        const proxyUrl = `${proxy.protocol}://${proxy.ip}:${proxy.port}`;
        return new HttpProxyAgent(proxyUrl);
    }

    // Create HTTPS proxy agent
    createHttpsAgent(proxy) {
        if (!proxy) return null;
        const proxyUrl = `${proxy.protocol}://${proxy.ip}:${proxy.port}`;
        return new HttpsProxyAgent(proxyUrl);
    }

    // Clean expired cache
    cleanCache() {
        const now = Date.now();
        for (const [key, value] of this.proxyCache.entries()) {
            if (now - value.timestamp > this.cacheTTL) {
                this.proxyCache.delete(key);
            }
        }
    }
}

// Singleton instance
const proxyManager = new ProxyManager();

// Clean cache every 10 minutes
setInterval(() => proxyManager.cleanCache(), 10 * 60 * 1000);

module.exports = proxyManager;

