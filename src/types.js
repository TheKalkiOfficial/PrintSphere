/**
 * Core Types and Interfaces for PrintSphere
 */

export class PrintSphereElement {
  constructor(type, props = {}) {
    this.type = type;
    this.x = props.x || 0;
    this.y = props.y || 0;
    this.width = props.width || 0;
    this.height = props.height || 0;
    this.rotation = props.rotation || 0;
    this.color = props.color || '#000000';
    this.props = props;
  }
}

export class LabelLayout {
  constructor(width, height, dpi = 203) {
    this.width = width;
    this.height = height;
    this.dpi = dpi;
    this.elements = [];
    this.margins = { top: 0, left: 0, right: 0, bottom: 0 };
    this.gap = 0;
    this.blackMark = false;
  }

  addElement(element) {
    this.elements.push(element);
  }

  clear() {
    this.elements = [];
  }

  toJSON() {
    return {
      width: this.width,
      height: this.height,
      dpi: this.dpi,
      elements: this.elements,
      margins: this.margins,
    };
  }
}

export class PrintSphereJob {
  constructor(jobId, language, rawData) {
    this.jobId = jobId;
    this.language = language;
    this.rawBuffer = Buffer.isBuffer(rawData) ? rawData : Buffer.from(typeof rawData === 'string' ? rawData : String(rawData || ''), 'latin1');
    this.rawData = this.rawBuffer.toString('latin1');
    this.timestamp = Date.now();
    this.status = 'queued';
    this.error = null;
    this.layout = null;
    this.previewHtml = null;
    this.responseData = null;
    this.renderTime = 0;
    this.parseTime = 0;
  }
}

export class PrintSphereConfig {
  constructor() {
    this.width = 203;
    this.height = 203;
    this.dpi = 203;
    this.unit = 'millimeters';
    this.printDensity = '8 dpmm (203 dpi)';
    this.host = '0.0.0.0';
    this.port = 9100;
    this.autoDetect = true;
    this.maxJobSize = 10 * 1024 * 1024;
    this.bufferSize = 1024;
    this.keepTcpAlive = true;
    this.saveLabels = false;
    this.fileType = 'svg';
    this.directoryPath = '';
    this.languageMode = 'ZPL';
    this.protocolMode = 'ZPL';
    this.zplStatus = {
      headOpen: false,
      paperOut: false,
      ribbonOut: false,
      paperJam: false,
      printerPaused: false,
      cutterFault: false,
      headTooHot: false,
      motorOverheat: false,
      rewindFault: false,
    };
    this.zplWarnings = {
      mediaNearEnd: false,
      ribbonNearEnd: false,
      replacePrinthead: false,
      cleanPrinthead: false,
    };
    this.zplErrors = {
      mediaOut: false,
      ribbonOut: false,
      headOpen: false,
      cutterFault: false,
      printheadOverTemp: false,
      motorOverTemp: false,
      badPrintheadElement: false,
      printheadDetectionError: false,
    };
    this.escposStatus = {
      online: true,
      paperFeedPressed: false,
      coverOpen: false,
      paperBeingFed: false,
      paperEnd: false,
      errorOccurred: false,
      recoverableError: false,
      cutterError: false,
      unrecoverableError: false,
      autoRecoverableError: false,
      paperLow: false,
    };
    this.timeout = 30000;
    this.logLevel = 'info';
  }
}
