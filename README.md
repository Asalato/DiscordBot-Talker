# 使い方（雑）
## どの起動方法でも共通で必要な作業
- プロジェクトのclone
- 環境変数、もしくは`.env`ファイルにDiscord BotのトークンとクライアントIDを記述
  - [Discord Developer Portalから取得](https://discordjs.guide/preparations/setting-up-a-bot-application.html#your-bot-s-token)

```.env
DISCORD_TOKEN="your-token-here"
DISCORD_CLIENT_ID="your-client-id-here"
```

### 必要な権限
- SCOPES
  - bot
  - applications.command
- BOT PERMISSIONS
  - Send Messages
  - Read Message History
  - Use Slash Commands
  - Messages/View Channels

機能を増やしたり減らしたりするとこの辺は変わります

## ローカル環境でビルドして起動する場合（デバッグ用途）
前提環境：node.js（v16でのみ確認済み）
1. `npm i`でパッケージのインストール
2. `node server.js`で起動

テンプレート通りの場合はこれで動作する

Express等で別途パケットの待ちなどを行う場合はFirewallの設定など別途やることがある

## Dockerコンテナとして起動する場合
1. プロジェクトルートでターミナルを起動
2. `docker build . -t discord-bot-template`でビルド
3. `docker run discord-bot-template`で実行

ストレージ永続化をしたい場合などはなんかがんばれ、、

マジで適当に`dockerfile`書いてるのでもうちょっと何とかした方がいいと思う

## Docker-Composeで起動したい場合
このテンプレートでは不要だが、ストレージ永続化したいときなどに

- 環境変数もテンプレートにかけて便利 
  - （サンプルコードだとこれgit管理しちゃってるので適宜`.gitignore`に書いてくださいね）

1. プロジェクトルートでターミナルを起動
2. `docker-compose up`で実行

コードを編集した後は`docker-compose up --build`にしないと更新されないので注意
