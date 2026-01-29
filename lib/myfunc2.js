var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
}
Object.defineProperty(exports, "__esModule", { value: true });

const axios = require("axios");
const cheerio = require("cheerio");
const { resolve } = require("path");
const util = require("util");
let BodyForm = require('form-data');
let { fromBuffer } = require('file-type');
let fs = require('fs');
const { Demuxer, Decoder, Encoder, Muxer } = require('node-av/api');
const { AV_PIX_FMT_YUV420P } = require('node-av/constants');

const { unlink } = require('fs').promises;

exports.sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

exports.fetchJson = async (url, options) => {
    try {
        options ? options : {}
        const res = await axios({
            method: 'GET',
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36'
            },
            ...options
        })
        return res.data
    } catch (err) {
        return err
    }
}

exports.fetchBuffer = async (url, options) => {
    try {
        options ? options : {}
        const res = await axios({
            method: "GET",
            url,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.70 Safari/537.36",
                'DNT': 1,
                'Upgrade-Insecure-Request': 1
            },
            ...options,
            responseType: 'arraybuffer'
        })
        return res.data
    } catch (err) {
        return err
    }
}

exports.webp2mp4File = async (path) => {
    return new Promise((resolve, reject) => {
        const form = new BodyForm()
        form.append('new-image-url', '')
        form.append('new-image', fs.createReadStream(path))
        axios({
            method: 'post',
            url: 'https://s6.ezgif.com/webp-to-mp4',
            data: form,
            headers: {
                'Content-Type': `multipart/form-data; boundary=${form._boundary}`
            }
        }).then(({ data }) => {
            const bodyFormThen = new BodyForm()
            const $ = cheerio.load(data)
            const file = $('input[name="file"]').attr('value')
            bodyFormThen.append('file', file)
            bodyFormThen.append('convert', "Convert WebP to MP4!")
            axios({
                method: 'post',
                url: 'https://ezgif.com/webp-to-mp4/' + file,
                data: bodyFormThen,
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${bodyFormThen._boundary}`
                }
            }).then(({ data }) => {
                const $ = cheerio.load(data)
                const result = 'https:' + $('div#output > p.outfile > video > source').attr('src')
                resolve({
                    status: true,
                    message: "Created By Eternity",
                    result: result
                })
            }).catch(reject)
        }).catch(reject)
    })
}

exports.fetchUrl = async (url, options) => {
    try {
        options ? options : {}
        const res = await axios({
            method: 'GET',
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36'
            },
            ...options
        })
        return res.data
    } catch (err) {
        return err
    }
}

exports.WAVersion = async () => {
    let get = await exports.fetchUrl("https://web.whatsapp.com/check-update?version=1&platform=web")
    let version = [get.currentVersion.replace(/[.]/g, ", ")]
    return version
}

exports.getRandom = (ext) => {
    return `${Math.floor(Math.random() * 10000)}${ext}`
}

exports.isUrl = (url) => {
    return url.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/, 'gi'))
}

exports.isNumber = (number) => {
    const int = parseInt(number)
    return typeof int === 'number' && !isNaN(int)
}

exports.TelegraPh = (Path) => {
    return new Promise(async (resolve, reject) => {
        if (!fs.existsSync(Path)) return reject(new Error("File not Found"))
        try {
            const form = new BodyForm();
            form.append("file", fs.createReadStream(Path))
            const data = await axios({
                url: "https://telegra.ph/upload",
                method: "POST",
                headers: {
                    ...form.getHeaders()
                },
                data: form
            })
            return resolve("https://telegra.ph" + data.data[0].src)
        } catch (err) {
            return reject(new Error(String(err)))
        }
    })
}

const sleepy = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// REPLACED buffergif function with node-av
exports.buffergif = async (image) => {
    const filename = `${Math.random().toString(36)}`;
    const inputPath = `../tmp/${filename}.gif`;
    const outputPath = `../tmp/${filename}.mp4`;

    // Write GIF to disk
    await fs.writeFileSync(inputPath, image);

    try {
        // Open input GIF
        await using input = await Demuxer.open(inputPath);

        // Get video stream
        const videoStream = input.video();
        if (!videoStream) {
            throw new Error('No video stream found in GIF');
        }

        // Create decoder
        using decoder = await Decoder.create(videoStream);

        // Create encoder for MP4 with yuv420p pixel format
        using encoder = await Encoder.create('libx264', {
            decoder, // Copy settings from decoder
            pixelFormat: AV_PIX_FMT_YUV420P,
            options: {
                movflags: 'faststart'
            }
        });

        // Open output MP4
        await using output = await Muxer.open(outputPath, {
            format: 'mp4'
        });

        // Add stream
        const outputIndex = output.addStream(encoder, {
            inputStream: videoStream
        });

        // Process: decode -> encode -> write
        const inputGenerator = input.packets(videoStream.index);
        const decoderGenerator = decoder.frames(inputGenerator);
        const encoderGenerator = encoder.packets(decoderGenerator);

        for await (using packet of encoderGenerator) {
            await output.writePacket(packet, outputIndex);
        }

        // Read output buffer
        const buffer5 = await fs.readFileSync(outputPath);

        // Cleanup
        await Promise.all([
            unlink(outputPath).catch(() => {}),
            unlink(inputPath).catch(() => {})
        ]);

        return buffer5;

    } catch (error) {
        // Cleanup on error
        await Promise.all([
            unlink(outputPath).catch(() => {}),
            unlink(inputPath).catch(() => {})
        ]);
        throw error;
    }
}
