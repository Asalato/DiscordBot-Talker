const fs = require('node:fs');

let data = null;
const fileName = './data/.tokenStore';

module.exports = class TokenStore {
    static #save() {
        fs.writeFileSync(fileName, JSON.stringify(data));
    }

    static #load() {
        if (!fs.existsSync(fileName)) {
            data = {};
            return;
        }

        data = JSON.parse(fs.readFileSync(fileName, 'utf-8'));
    }

    static async getSessionToken() {
        if (data == null) this.#load();
        if (data.hasOwnProperty("sessionToken")) return data["sessionToken"];
        return undefined;
    }

    static async setSessionToken(token) {
        if (data == null) this.#load();
        data["sessionToken"] = token;
        this.#save();
    }

    static async getParentMessageId(messageId) {
        if (data == null) this.#load();
        if (!data.hasOwnProperty("parentMessage")) return undefined;
        if (!data["parentMessage"].hasOwnProperty(messageId)) return undefined;
        return data["parentMessage"][messageId];
    }

    static async setParentMessageId(messageId, conversationId) {
        if (data == null) this.#load();
        if (!data.hasOwnProperty("parentMessage")) data["parentMessage"] = {};
        data["parentMessage"][messageId] = conversationId;
        if (Object.keys(data["parentMessage"]).length > 100) data["parentMessage"].shift();
        this.#save();
    }

    static async getConversationId(messageId) {
        if (data == null) this.#load();
        if (!data.hasOwnProperty("conversations")) return undefined;
        if (!data["conversations"].hasOwnProperty(messageId)) return undefined;
        return data["conversations"][messageId];
    }

    static async setConversationId(messageId, conversationId) {
        if (data == null) this.#load();
        if (!data.hasOwnProperty("conversations")) data["conversations"] = {};
        data["conversations"][messageId] = conversationId;
        if (Object.keys(data["conversations"]).length > 100) data["conversations"].shift();
        this.#save();
    }
}
