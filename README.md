# 部屋ダッシュボード

CHIRIMEN の remote-sht30（SHT30）と Freenove FNK0066 の BMP180・フォトレジスタ・人感センサーで、部屋の温度・湿度・気圧・明るさ・在室を見る Next.js アプリです。

## 起動

```bash
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開きます。センサーが無くても、seed した約 30 日分の履歴でグラフを確認できます。

## 実機（Raspberry Pi Zero 2W）

Zero 2W ではブラウザではなく Node の `main.js` を使います。

1. [chirimen/README.md](chirimen/README.md) の配線をする
2. Pi 上で `cd chirimen && npm install && node main.js`
3. ダッシュボードと同じ Relay チャンネル（`chirimenRoom`）を購読してライブ値を表示します

リレー設定は `.env` の `NEXT_PUBLIC_RELAY_*` です。
