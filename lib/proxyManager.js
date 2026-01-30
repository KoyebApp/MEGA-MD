
const axios = require('axios');
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

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
            return { country: 'PK', city: 'Unknown', isp: 'Unknown' };
        }
    }

    // Get proxy from public API
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
            
            // Try multiple proxy sources
            let proxy = null;
            
            // Source 1: ProxyScrape
            try {
                const response = await axios.get('https://api.proxyscrape.com/v2/', {
                    params: {
                        request: 'get',
                        protocol: 'http',
                        timeout: 5000,
                        country: location.country.toLowerCase(),
                        ssl: 'all',
                        anonymity: 'elite'
                    },
                    timeout: 10000
                });
                
                const proxies = response.data.split('\n').filter(p => p.trim());
                if (proxies.length > 0) {
                    const [ip, port] = proxies[0].split(':');
                    proxy = {
                        ip: ip.trim(),
                        port: parseInt(port.trim()),
                        protocol: 'http',
                        country: location.country
                    };
                }
            } catch (error) {
                console.log('ProxyScrape failed:', error.message);
            }

            // Source 2: Fallback to any country if no proxy found
            if (!proxy) {
                console.log(`No proxy for ${location.country}, trying any country...`);
                try {
                    const response = await axios.get('https://api.proxyscrape.com/v2/', {
                        params: {
                            request: 'get',
                            protocol: 'http',
                            timeout: 5000,
                            ssl: 'all',
                            anonymity: 'elite'
                        },
                        timeout: 10000
                    });
                    
                    const proxies = response.data.split('\n').filter(p => p.trim());
                    if (proxies.length > 0) {
                        const [ip, port] = proxies[0].split(':');
                        proxy = {
                            ip: ip.trim(),
                            port: parseInt(port.trim()),
                            protocol: 'http',
                            country: 'ANY'
                        };
                    }
                } catch (error) {
                    console.log('ProxyScrape fallback failed:', error.message);
                }
            }

            // Source 3: Use free public proxies as last resort
            if (!proxy) {
                console.log('Using hardcoded public proxies...');
                const publicProxies = [
                    { ip: '8.8.8.8', port: 8080, protocol: 'http', country: 'US' },
                    { ip: '1.1.1.1', port: 8080, protocol: 'http', country: 'US' }
                ];
                proxy = publicProxies[Math.floor(Math.random() * publicProxies.length)];
            }

            if (!proxy) {
                throw new Error('No working proxy available');
            }

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
