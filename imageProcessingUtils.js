import fetch from 'node-fetch';
import sharp from 'sharp';

export default {
    getAndResizeImage: async (url, size) => {
        const [width, height] = size;

        const response = await fetch(url);
        const buffer = await response.buffer();

        const resizedImage = await sharp(buffer)
            .resize({
                width: width,
                height: height,
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .jpeg()
            .toBuffer();
        return resizedImage.toString('base64');
    }
}