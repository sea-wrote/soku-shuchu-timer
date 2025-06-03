簡易的にブラウザで確認する場合には、

```bash
npm run dev
```

をした後で

`http://localhost:3000`

にアクセスすればブラウザで見れる

XCodeまたは実機で確認する時には以下の手順ででできる。

Capacitorプロジェクトを最新化

```bash
npm run build
npx cap sync ios
```

プロジェクトを開く

```bash
npx cap open ios
```



