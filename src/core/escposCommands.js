/**
 * ESC/POS status command emulation
 */

export class EscPosCommands {
  constructor(configs = {}) {
    this.configs = configs;
    this.commands = {
      getStatusCommand: '\x10\x04\x01',
      getOfflineCauseCommand: '\x10\x04\x02',
      getErrorCauseCommand: '\x10\x04\x03',
      getRollPaperStatusCommand: '\x10\x04\x04',
    };
  }

  matchCommand(data) {
    return Object.values(this.commands).includes(data);
  }

  getResponse(data) {
    switch (data) {
      case this.commands.getStatusCommand:
        return Buffer.from(this.getEscposStatus());
      case this.commands.getOfflineCauseCommand:
        return Buffer.from(this.getOfflineCause());
      case this.commands.getErrorCauseCommand:
        return Buffer.from(this.getErrorCause());
      case this.commands.getRollPaperStatusCommand:
        return Buffer.from(this.getRollPaperStatus());
      default:
        return null;
    }
  }

  isTruthy(value) {
    return [1, '1', true, 'true'].includes(value);
  }

  getEscposStatus() {
    const c = this.configs.escposStatus || {};
    const bytes = [0x00];

    if (!this.isTruthy(c.online)) {
      bytes[0] |= 0b00001000;
    }
    if (this.isTruthy(c.paperFeedPressed)) {
      bytes[0] |= 0b01000000;
    }

    return bytes;
  }

  getOfflineCause() {
    const c = this.configs.escposStatus || {};
    const bytes = [0x00];

    if (this.isTruthy(c.coverOpen)) {
      bytes[0] |= 0b00000100;
    }
    if (this.isTruthy(c.paperBeingFed)) {
      bytes[0] |= 0b00001000;
    }
    if (this.isTruthy(c.paperEnd)) {
      bytes[0] |= 0b00100000;
    }
    if (this.isTruthy(c.errorOccurred)) {
      bytes[0] |= 0b01000000;
    }

    return bytes;
  }

  getErrorCause() {
    const c = this.configs.escposStatus || {};
    const bytes = [0x00];

    if (this.isTruthy(c.recoverableError)) {
      bytes[0] |= 0b00000100;
    }
    if (this.isTruthy(c.cutterError)) {
      bytes[0] |= 0b00001000;
    }
    if (this.isTruthy(c.unrecoverableError)) {
      bytes[0] |= 0b00100000;
    }
    if (this.isTruthy(c.autoRecoverableError)) {
      bytes[0] |= 0b01000000;
    }

    return bytes;
  }

  getRollPaperStatus() {
    const c = this.configs.escposStatus || {};
    const bytes = [0x00];

    if (this.isTruthy(c.paperLow)) {
      bytes[0] |= 0b00001100;
    }

    return bytes;
  }
}

export default EscPosCommands;
