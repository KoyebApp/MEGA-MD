const fastgate = require('fastgate');
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const http2 = require('http2-wrapper');
const nyro = require('nyro');
const { UserAgent } = nyro;

class ProxyManager {
    constructor() {
        this.proxyCache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    }

    // Get user's geolocation from IP
    async getUserLocation(userIp) {
        try {
            const { body } = await nyro.get(`http://ip-api.com/json/${userIp}`, {
                responseType: 'json',
                timeout: 5000
            });
            
            return {
                country: body.countryCode || 'US',
                city: body.city || 'Unknown',
                isp: body.isp || 'Unknown'
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
            
            // Try to get proxy from same country
            let proxy = await fastgate.getProxy({
                force: false,
                proxyOptions: {
                    alive: true,
                    country: location.country.toLowerCase(),
                    timeout: (timeout) => timeout < 5000,
                    ...options
                }
            });

            // Fallback: try any working proxy
            if (!proxy) {
                console.log(`No proxy for ${location.country}, trying any alive proxy...`);
                proxy = await fastgate.getProxy({
                    force: false,
                    proxyOptions: {
                        alive: true,
                        timeout: (timeout) => timeout < 5000
                    }
                });
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
        const proxyUrl = `http://${proxy.ip}:${proxy.port}`;
        return new HttpProxyAgent(proxyUrl);
    }

    // Create HTTPS proxy agent
    createHttpsAgent(proxy) {
        if (!proxy) return null;
        const proxyUrl = `http://${proxy.ip}:${proxy.port}`;
        return new HttpsProxyAgent(proxyUrl);
    }

    // Make HTTP/HTTPS request with auto proxy
    async request(url, userIp, options = {}) {
        const proxy = await this.getProxyForUser(userIp);
        
        if (!proxy) {
            console.warn('No proxy available, making direct request');
        }

        const isHttps = url.startsWith('https://');
        const agent = isHttps 
            ? this.createHttpsAgent(proxy)
            : this.createHttpAgent(proxy);

        return await nyro({
            url,
            method: options.method || 'GET',
            headers: {
                'User-Agent': UserAgent.generate({ browser: 'Chrome' }),
                ...options.headers
            },
            body: options.body,
            responseType: options.responseType || 'json',
            timeout: options.timeout || 30000,
            // Use native agent (not nyro's proxy option)
            agent: agent
        });
    }

    // Make HTTP/2 request with auto proxy
    async requestHttp2(url, userIp, options = {}) {
        const proxy = await this.getProxyForUser(userIp);
        
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            protocol: urlObj.protocol,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'user-agent': UserAgent.generate({ browser: 'Chrome' }),
                ...options.headers
            }
        };

        if (proxy) {
            // HTTP/2 over proxy requires special handling
            const agent = this.createHttpsAgent(proxy);
            requestOptions.agent = agent;
        }

        return new Promise((resolve, reject) => {
            const request = http2.request(requestOptions, (response) => {
                const body = [];
                response.on('data', chunk => body.push(chunk));
                response.on('end', () => {
                    resolve({
                        statusCode: response.statusCode,
                        headers: response.headers,
                        body: Buffer.concat(body).toString()
                    });
                });
            });

            request.on('error', reject);

            if (options.body) {
                request.write(options.body);
            }
            request.end();
        });
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

