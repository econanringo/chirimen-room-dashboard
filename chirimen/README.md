# CHIRIMEN センサー収集（Raspberry Pi Zero 2W）

Zero 2W では Chromium の HTML は使いません。CHIRIMEN の Node.js 向け API（`node-web-i2c` / `node-web-gpio`）で [`main.js`](./main.js) を動かします。

ダッシュボード（Next.js）が同じ Relay チャンネルを購読して表示・保存します。チャンネル名は `chirimenRoom` です。公開リレーなので秘密は載せないでください。

## Pi での起動

I2C を有効にし、`gpio` / `i2c` グループにユーザーを入れてください。

```bash
sudo raspi-config
# Interface Options → I2C → Enable

cd chirimen
npm install
node main.js
```

`node-web-gpio` は Linux 専用のネイティブモジュールなので、`npm install` は Zero 2W 上で実行します。必要なら:

```bash
sudo apt install build-essential python3
```

`chirimentest`（Heroku）が落ちているときは、[`chirimen-web-socket-relay`](https://github.com/chirimen-oh/chirimen-web-socket-relay) を自前起動し、環境変数で合わせます。

```bash
RELAY_URL=wss://自前ホスト RELAY_TOKEN=chirimenSocket RELAY_CHANNEL=chirimenRoom node main.js
```

ダッシュボード側の `.env` の `NEXT_PUBLIC_RELAY_*` も同じ値にしてください。

常時起動する例:

```bash
# crontab -e
@reboot cd /home/pi/room-dashboard/chirimen && /usr/bin/node main.js >> /tmp/room-sensors.log 2>&1
```

## 配線

I2C は Raspberry Pi Zero 2W の I2C-1 を共有します。アドレスが全部違うので SDA/SCL は 1 本で足ります。ピン番号は物理ピンです。

### SHT30（温湿度）

VCC は **3.3V**。SDA/SCL/GND は BMP180 と同じバスです。I2C アドレスは `0x44`。

### BMP180（気圧）

VCC は **3.3V 専用**です（動作範囲 1.6–3.6V）。**5V は壊します。**

| BMP180 | Pi Zero 2W |
| --- | --- |
| VIN / VCC | 3.3V（ピン 1） |
| GND | GND（ピン 6 など） |
| SDA | SDA（ピン 3 / GPIO 2） |
| SCL | SCL（ピン 5 / GPIO 3） |

I2C アドレスは `0x77` です。

### ADS7830 + フォトレジスタ（明るさ）

ADC モジュール自体も **3.3V** です。プログラムはチャンネル 0（A0 / CH0）を読みます。

**モジュール → Pi**

| ADS7830 | Pi Zero 2W |
| --- | --- |
| VCC / +VDD | 3.3V（ピン 1） |
| GND | GND |
| SDA | SDA（ピン 3） |
| SCL | SCL（ピン 5） |

**フォトレジスタ（分圧）→ ADS7830 の A0**

キットの 10kΩ を 1 本使います。

1. 3.3V → フォトレジスタの一端
2. フォトレジスタのもう一端 → ADS7830 の **A0**（CH0）と、10kΩ の一端（ここが分岐点）
3. 10kΩ のもう一端 → GND

明るさは 0–100 の相対値で、**明るいほど 100%** です（分圧の向きをプログラム側で反転しています）。I2C アドレスは `0x4b` のはずです。

### HW416A（人感）

デジタル出力なので ADC にはつなぎません。VCC は **5V 推奨**（3–5V 動作、5V の方が安定しやすい）。OUT は 3.3V ロジックなので GPIO に直結できます。

| HW416A | Pi Zero 2W |
| --- | --- |
| VCC | 5V（ピン 2 または 4） |
| GND | GND |
| OUT | GPIO 17（ピン 11） |

ピンの並びは基板の印刷を見てください。PIR は GND と VCC が逆の個体があります。ジャンパは繰り返しトリガ側、電源投入後およそ 1 分は初期化で値が不安定です。

接続確認:

```bash
i2cdetect -y 1
```

SHT30 なら `44`、BMP180 なら `77`、ADC なら `48` または `4b` が見えます。

## 動作

- 30 秒ごとに `{ temperature, humidity, pressure, light, occupied }` を送信します。無いセンサーは `null` です
- ダッシュボードからの `GET SENSOR DATA` にも応答します
- 人感の変化でもすぐ送ります
- Next.js を LAN で常時起動している場合は、`INGEST_URL=http://<PCのIP>:3000/api/readings node main.js` とすると、ダッシュボードを開いていなくても履歴が貯まります
