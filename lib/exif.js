const fs = require('fs')
const { tmpdir } = require("os")
const Crypto = require("crypto")
const webp = require("node-webpmux")
const path = require("path")
const { Demuxer, Decoder, Encoder, Muxer } = require('node-av/api')
const { AV_PIX_FMT_YUVA420P } = require('node-av/constants')

async function imageToWebp(media) {
    const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.jpg`)

    fs.writeFileSync(tmpFileIn, media)

    try {
        // Open input
        await using input = await Demuxer.open(tmpFileIn)
        
        // Get video stream
        const videoStream = input.video()
        if (!videoStream) {
            throw new Error('No video stream found in image')
        }

        // Create decoder
        using decoder = await Decoder.create(videoStream)

        // Create encoder for WebP with specific settings
        using encoder = await Encoder.create('libwebp', {
            width: 320,
            height: 320,
            pixelFormat: AV_PIX_FMT_YUVA420P,
            frameRate: { num: 15, den: 1 }
        })

        // Open output
        await using output = await Muxer.open(tmpFileOut, {
            format: 'webp'
        })

        // Add stream
        const outputIndex = output.addStream(encoder)

        // Process: decode -> encode -> write
        const inputGenerator = input.packets(videoStream.index)
        const decoderGenerator = decoder.frames(inputGenerator)
        const encoderGenerator = encoder.packets(decoderGenerator)

        for await (using packet of encoderGenerator) {
            await output.writePacket(packet, outputIndex)
        }

        const buff = fs.readFileSync(tmpFileOut)
        fs.unlinkSync(tmpFileOut)
        fs.unlinkSync(tmpFileIn)
        return buff
    } catch (error) {
        if (fs.existsSync(tmpFileOut)) fs.unlinkSync(tmpFileOut)
        if (fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn)
        throw error
    }
}

async function videoToWebp(media) {
    const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.mp4`)

    fs.writeFileSync(tmpFileIn, media)

    try {
        // Open input
        await using input = await Demuxer.open(tmpFileIn)
        
        // Get video stream
        const videoStream = input.video()
        if (!videoStream) {
            throw new Error('No video stream found')
        }

        // Create decoder
        using decoder = await Decoder.create(videoStream)

        // Create encoder for animated WebP
        using encoder = await Encoder.create('libwebp', {
            width: 320,
            height: 320,
            pixelFormat: AV_PIX_FMT_YUVA420P,
            frameRate: { num: 15, den: 1 },
            options: {
                loop: '0',
                preset: 'default'
            }
        })

        // Open output
        await using output = await Muxer.open(tmpFileOut, {
            format: 'webp'
        })

        // Add stream
        const outputIndex = output.addStream(encoder)

        // Process frames (limit to 5 seconds @ 15fps = 75 frames)
        const inputGenerator = input.packets(videoStream.index)
        const decoderGenerator = decoder.frames(inputGenerator)
        
        let frameCount = 0
        const maxFrames = 5 * 15 // 5 seconds at 15fps

        for await (using frame of decoderGenerator) {
            if (frameCount >= maxFrames) break
            
            // Encode frame
            for await (using packet of encoder.packetsSync(frame)) {
                await output.writePacket(packet, outputIndex)
            }
            
            frameCount++
        }

        // Flush encoder
        for await (using packet of encoder.packetsSync(null)) {
            await output.writePacket(packet, outputIndex)
        }

        const buff = fs.readFileSync(tmpFileOut)
        fs.unlinkSync(tmpFileOut)
        fs.unlinkSync(tmpFileIn)
        return buff
    } catch (error) {
        if (fs.existsSync(tmpFileOut)) fs.unlinkSync(tmpFileOut)
        if (fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn)
        throw error
    }
}

async function writeExifImg(media, metadata) {
    let wMedia = await imageToWebp(media)
    const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    fs.writeFileSync(tmpFileIn, wMedia)

    try {
        if (metadata.packname || metadata.author) {
            const img = new webp.Image()
            const json = {
                "sticker-pack-id": `https://github.com/mruniquehacker/Knightbot`,
                "sticker-pack-name": metadata.packname,
                "sticker-pack-publisher": metadata.author,
                "emojis": metadata.categories ? metadata.categories : [""]
            }
            const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00])
            const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8")
            const exif = Buffer.concat([exifAttr, jsonBuff])
            exif.writeUIntLE(jsonBuff.length, 14, 4)
            await img.load(tmpFileIn)
            fs.unlinkSync(tmpFileIn)
            img.exif = exif
            await img.save(tmpFileOut)
            return tmpFileOut
        }
    } catch (error) {
        if (fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn)
        if (fs.existsSync(tmpFileOut)) fs.unlinkSync(tmpFileOut)
        throw error
    }
}

async function writeExifVid(media, metadata) {
    let wMedia = await videoToWebp(media)
    const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    fs.writeFileSync(tmpFileIn, wMedia)

    try {
        if (metadata.packname || metadata.author) {
            const img = new webp.Image()
            const json = {
                "sticker-pack-id": `https://github.com/mruniquehacker/Knightbot`,
                "sticker-pack-name": metadata.packname,
                "sticker-pack-publisher": metadata.author,
                "emojis": metadata.categories ? metadata.categories : [""]
            }
            const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00])
            const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8")
            const exif = Buffer.concat([exifAttr, jsonBuff])
            exif.writeUIntLE(jsonBuff.length, 14, 4)
            await img.load(tmpFileIn)
            fs.unlinkSync(tmpFileIn)
            img.exif = exif
            await img.save(tmpFileOut)
            return tmpFileOut
        }
    } catch (error) {
        if (fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn)
        if (fs.existsSync(tmpFileOut)) fs.unlinkSync(tmpFileOut)
        throw error
    }
}

async function writeExif(media, metadata) {
    let wMedia = /webp/.test(media.mimetype) ? media.data : /image/.test(media.mimetype) ? await imageToWebp(media.data) : /video/.test(media.mimetype) ? await videoToWebp(media.data) : ""
    const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    fs.writeFileSync(tmpFileIn, wMedia)

    try {
        if (metadata.packname || metadata.author) {
            const img = new webp.Image()
            const json = {
                "sticker-pack-id": `https://github.com/mruniquehacker/Knightbot`,
                "sticker-pack-name": metadata.packname,
                "sticker-pack-publisher": metadata.author,
                "emojis": metadata.categories ? metadata.categories : [""]
            }
            const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00])
            const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8")
            const exif = Buffer.concat([exifAttr, jsonBuff])
            exif.writeUIntLE(jsonBuff.length, 14, 4)
            await img.load(tmpFileIn)
            fs.unlinkSync(tmpFileIn)
            img.exif = exif
            await img.save(tmpFileOut)
            return tmpFileOut
        }
    } catch (error) {
        if (fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn)
        if (fs.existsSync(tmpFileOut)) fs.unlinkSync(tmpFileOut)
        throw error
    }
}

module.exports = { imageToWebp, videoToWebp, writeExifImg, writeExifVid, writeExif }
