const {SlashCommandBuilder} = require("discord.js");
const TokenStore = require("../tokenStore");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set')
        .setDescription('SessionTokenを登録します')
        .addStringOption(option =>
            option.setName('token')
                .setDescription("登録するSessionToken（詳細は https://github.com/transitive-bullshit/chatgpt-api#session-tokens とか参照）")
                .setRequired(true)),
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;
        await interaction.deferReply();

        try {
            const token = interaction.options.getString('token');
            await TokenStore.setSessionToken(token);
            await interaction.editReply("SessionTokenを登録しました。");
        } catch (error) {
            console.error(error);
            await interaction.editReply("何故かコマンドの実行に失敗しました");
        }
    },
};
