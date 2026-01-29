const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// 1. CATBOX.MOE (RECOMMENDED - 200MB, permanent, anonymous)
async function uploadToCatbox(filePath) {
    try {
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', fs.createReadStream(filePath));

        const response = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        return {
            status: true,
            url: response.data.trim()
        };
    } catch (error) {
        throw new Error(`Catbox upload failed: ${error.message}`);
    }
}

// 2. POMF.LAIN.LA (1GB limit, permanent)
async function uploadToPomf(filePath) {
    try {
        const form = new FormData();
        form.append('files[]', fs.createReadStream(filePath));

        const response = await axios.post('https://pomf.lain.la/upload.php', form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        if (response.data.success && response.data.files && response.data.files.length > 0) {
            return {
                status: true,
                url: response.data.files[0].url
            };
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        throw new Error(`Pomf upload failed: ${error.message}`);
    }
}

// 3. IMGBB (Requires API key, 32MB, images only)
async function uploadToImgbb(filePath, apiKey) {
    try {
        const imageBuffer = fs.readFileSync(filePath);
        const base64Image = imageBuffer.toString('base64');

        const form = new FormData();
        form.append('image', base64Image);

        const response = await axios.post(`https://api.imgbb.com/1/upload?key=${apiKey}`, form, {
            headers: form.getHeaders()
        });

        if (response.data.success) {
            return {
                status: true,
                url: response.data.data.url,
                display_url: response.data.data.display_url,
                delete_url: response.data.data.delete_url
            };
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        throw new Error(`Imgbb upload failed: ${error.message}`);
    }
}

// 4. FREEIMAGE.HOST (Free, no API key needed)
async function uploadToFreeimage(filePath) {
    try {
        const form = new FormData();
        form.append('source', fs.createReadStream(filePath));
        form.append('type', 'file');
        form.append('action', 'upload');

        const response = await axios.post('https://freeimage.host/api/1/upload?key=6d207e02198a847aa98d0a2a901485a5', form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        if (response.data.success) {
            return {
                status: true,
                url: response.data.image.url,
                display_url: response.data.image.display_url,
                delete_url: response.data.image.delete_url
            };
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        throw new Error(`Freeimage upload failed: ${error.message}`);
    }
}

// 5. LITTERBOX (Temporary files - 1h/12h/24h/72h)
async function uploadToLitterbox(filePath, time = '1h') {
    try {
        // Valid times: 1h, 12h, 24h, 72h
        if (!['1h', '12h', '24h', '72h'].includes(time)) {
            time = '1h';
        }

        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('time', time);
        form.append('fileToUpload', fs.createReadStream(filePath));

        const response = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        return {
            status: true,
            url: response.data.trim(),
            expires: time
        };
    } catch (error) {
        throw new Error(`Litterbox upload failed: ${error.message}`);
    }
}

// 6. MULTI-SERVICE UPLOADER (tries multiple services)
async function uploadFile(filePath) {
    const uploaders = [
        { name: 'Catbox', fn: () => uploadToCatbox(filePath) },
        { name: 'Pomf', fn: () => uploadToPomf(filePath) },
        { name: 'Freeimage', fn: () => uploadToFreeimage(filePath) }
    ];

    for (const uploader of uploaders) {
        try {
            console.log(`[Upload] Trying ${uploader.name}...`);
            const result = await uploader.fn();
            console.log(`[Upload] ✓ Success with ${uploader.name}`);
            return { ...result, service: uploader.name };
        } catch (error) {
            console.error(`[Upload] ✗ ${uploader.name} failed:`, error.message);
            continue;
        }
    }

    throw new Error('All upload services failed');
}

module.exports = {
    uploadToCatbox,
    uploadToPomf,
    uploadToImgbb,
    uploadToFreeimage,
    uploadToLitterbox,
    uploadFile // Auto-tries multiple services
};

                    
