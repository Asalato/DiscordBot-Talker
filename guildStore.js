import fs from 'node:fs';
import path from "node:path";

let data = null;
const fileName = './data/.guildStore';

export default class GuildStore {
    static #save() {
        const dirName = path.dirname(fileName);
        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName, {recursive: true});
        }
        fs.writeFileSync(fileName, JSON.stringify(data));
    }

    static #load() {
        if (!fs.existsSync(fileName)) {
            data = [];
            return;
        }

        data = JSON.parse(fs.readFileSync(fileName, 'utf-8'));
    }

    static async getAllIds() {
        if (data == null) this.#load();
        return data;
    }

    static async setId(id) {
        if (data == null) this.#load();
        if (data.includes(id)) return;
        data.push(id);

        this.#save();
        console.log(`Add new Guild Id: ${id}`);
    }
}
