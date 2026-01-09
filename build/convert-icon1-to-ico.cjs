const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const input = path.join(__dirname, '..', 'icon1.png');
const output = path.join(__dirname, 'icon.ico');

async function convert() {
    if (!fs.existsSync(input)) {
        console.warn('icon1.png not found, skipping conversion');
        return;
    }

    if (!fs.existsSync(__dirname)) {
        fs.mkdirSync(__dirname);
    }

    try {
        await sharp(input)
            .resize(256, 256)
            .toFile(output);
        console.log('Icon converted successfully');
    } catch (err) {
        console.error('Failed to convert icon:', err);
    }
}

convert();
