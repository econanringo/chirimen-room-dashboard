/**
 * ADS7830 8-bit ADC (FNK0066 kits that do not include PCF8591).
 * I2C address is usually 0x4b. Channel 0-7, single-ended.
 */
export class ADS7830 {
  constructor(i2cPort, slaveAddress = 0x4b) {
    this.i2cPort = i2cPort;
    this.slaveAddress = slaveAddress;
    this.i2cSlave = null;
  }

  async init() {
    this.i2cSlave = await this.i2cPort.open(this.slaveAddress);
  }

  async analogRead(channel = 0) {
    const ch = channel & 0x07;
    const command = 0x84 | (ch << 4);
    if (typeof this.i2cSlave.writeBytes === "function") {
      await this.i2cSlave.writeBytes([command]);
      const bytes = await this.i2cSlave.readBytes(1);
      return bytes[0];
    }
    await this.i2cSlave.write8(command, 0);
    return this.i2cSlave.read8(command);
  }
}
