const fs = require('fs');

let data = null;

module.exports = class GuildStore {
    static #save() {
        fs.writeFileSync('.guildStore', JSON.stringify(data));
    }

    static #load() {
        if (!fs.existsSync('.guildStore')) {
            data = [];
            return;
        }

        data = JSON.parse(fs.readFileSync('.guildStore', 'utf-8'));
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
