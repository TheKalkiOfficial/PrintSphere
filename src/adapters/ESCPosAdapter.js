/**
 * ESC/POS Adapter - receipt HTML rendering support
 */

import { PrintSphereElement, LabelLayout } from '../types.js';

const ESC_POS_RENDER_URL = 'https://test.rubyks.com/escpos/base64html.php';

export class ESCPosAdapter {
  static parse(rawData) {
    const text = ESCPosAdapter.normalizeToPrintableText(rawData);
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+$/g, ''))
      .filter((line, index, arr) => line.length > 0 || (index > 0 && index < arr.length - 1));

    const fontSize = 16;
    const lineHeight = 24;
    const padding = 20;
    const width = 420;
    const height = Math.max(220, padding * 2 + Math.max(lines.length, 1) * lineHeight);
    const layout = new LabelLayout(width, height, 203);

    if (lines.length === 0) {
      lines.push('ESC/POS receipt received');
    }

    lines.forEach((line, index) => {
      layout.addElement(
        new PrintSphereElement('text', {
          x: padding,
          y: padding + (index + 1) * lineHeight,
          text: line,
          font: 'monospace',
          fontSize,
        })
      );
    });

    return {
      success: true,
      layout,
      elementCount: layout.elements.length,
    };
  }

  static normalizeToPrintableText(rawData) {
    const buffer = ESCPosAdapter.stripNonTextPayloads(ESCPosAdapter.toBuffer(rawData));
    let text = buffer.toString('latin1');

    text = text
      .replace(/\x1b@/g, '')
      .replace(/\x1bE[\x00-\x01]?/g, '')
      .replace(/\x1ba[\x00-\x02]?/gi, '')
      .replace(/\x1b!\S?/g, '')
      .replace(/\x1dV\S?/g, '')
      .replace(/\x1dp\S?/g, '')
      .replace(/\x10\x04[\x01-\x04]/g, '')
      .replace(/\x1b\x64[\x00-\xff]?/g, '\n')
      .replace(/\x0c/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    text = text
      .replace(/[^\x09\x0a\x20-\x7e]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return ESCPosAdapter.removeLeadingBinaryNoise(text);
  }

  static stripNonTextPayloads(buffer) {
    const bytes = [];

    for (let index = 0; index < buffer.length; index += 1) {
      const current = buffer[index];
      const next = index + 1 < buffer.length ? buffer[index + 1] : null;

      if (current === 0x1d && next === 0x76) {
        const mode = index + 2 < buffer.length ? buffer[index + 2] : null;
        const zero = index + 3 < buffer.length ? buffer[index + 3] : null;

        if (mode === 0x30 && zero !== null) {
          const xL = buffer[index + 4] ?? 0;
          const xH = buffer[index + 5] ?? 0;
          const yL = buffer[index + 6] ?? 0;
          const yH = buffer[index + 7] ?? 0;
          const widthBytes = xL + (xH << 8);
          const height = yL + (yH << 8);
          const payloadLength = widthBytes * height;
          index += 7 + payloadLength;
          continue;
        }
      }

      if (current === 0x1b && next === 0x2a) {
        const nL = buffer[index + 3] ?? 0;
        const nH = buffer[index + 4] ?? 0;
        const payloadLength = nL + (nH << 8);
        index += 4 + payloadLength;
        continue;
      }

      if (current === 0x1d && next === 0x28) {
        const command = buffer[index + 2] ?? null;
        const pL = buffer[index + 3] ?? 0;
        const pH = buffer[index + 4] ?? 0;
        const payloadLength = pL + (pH << 8);

        if (command === 0x4c || command === 0x6b) {
          index += 4 + payloadLength;
          continue;
        }
      }

      bytes.push(current);
    }

    return Buffer.from(bytes);
  }

  static async renderHtml(rawData, config = {}) {
    const buffer = ESCPosAdapter.toBuffer(rawData);
    const specialHtml = ESCPosAdapter.renderSpecialCase(buffer);
    if (specialHtml) {
      return specialHtml;
    }

    const unit = String(config.unit || 'millimeters');
    const width = Number.parseFloat(config.width) || 58;
    const widthMm = ESCPosAdapter.convertToMillimeters(width, unit);
    const renderWidth = `${Math.round((widthMm + 5) * 1000) / 1000}mm`;

    const formBody = new URLSearchParams({
      esc: buffer.toString('base64'),
      width: renderWidth,
    });

    const response = await fetch(ESC_POS_RENDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: formBody.toString(),
    });

    if (!response.ok) {
      throw new Error(`ESC/POS render service returned ${response.status}`);
    }

    const encodedHtml = await response.text();
    return ESCPosAdapter.decodeBase64Unicode(encodedHtml);
  }

  static renderSpecialCase(buffer) {
    const text = buffer.toString('latin1');

    if (!text.replace(/\x1b@/g, '').trim()) {
      return ESCPosAdapter.wrapHtml('<div class="escpos-message"><strong>EMPTY / NO DATA</strong></div>');
    }

    if (buffer.length === 5 && (text.startsWith('\x1bp') || text.startsWith('\x10\x14'))) {
      return ESCPosAdapter.wrapHtml('<div class="escpos-message"><strong>CASH REGISTER PULSE</strong></div>');
    }

    if (buffer.length <= 4 && (text.startsWith('\x1dV') || text.startsWith('\x1de') || text.startsWith('\x1bi'))) {
      return ESCPosAdapter.wrapHtml('<div class="escpos-message"><strong>PAPER CUT</strong></div>');
    }

    return null;
  }

  static wrapHtml(innerHtml) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; background: #f8f8f8; }
    .sheet {
      width: 320px;
      margin: 0 auto;
      background: white;
      border: 1px solid #dee2e6;
      min-height: 160px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: "Courier New", monospace;
      padding: 24px 16px;
      box-sizing: border-box;
      text-align: center;
    }
    .escpos-message { font-size: 18px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="sheet">${innerHtml}</div>
</body>
</html>`;
  }

  static toBuffer(rawData) {
    if (Buffer.isBuffer(rawData)) {
      return rawData;
    }

    const stringValue = typeof rawData === 'string' ? rawData : String(rawData || '');
    const trimmed = stringValue.trim();

    if (ESCPosAdapter.looksLikeBase64(trimmed)) {
      try {
        const decoded = Buffer.from(trimmed, 'base64');
        if (decoded.length > 0) {
          return decoded;
        }
      } catch {
        // Fall back to latin1 below.
      }
    }

    return Buffer.from(stringValue, 'latin1');
  }

  static decodeBase64Unicode(base64) {
    const binary = Buffer.from(base64, 'base64');
    return binary.toString('utf8');
  }

  static looksLikeBase64(value) {
    if (!value || value.length < 16 || value.length % 4 !== 0) {
      return false;
    }

    if (!/^[A-Za-z0-9+/=\r\n]+$/.test(value)) {
      return false;
    }

    return true;
  }

  static removeLeadingBinaryNoise(text) {
    const lines = text.split(/\n+/);
    let firstPrintableIndex = 0;

    while (firstPrintableIndex < lines.length) {
      const line = lines[firstPrintableIndex].trim();
      if (!line) {
        firstPrintableIndex += 1;
        continue;
      }

      const letters = (line.match(/[A-Za-z0-9]/g) || []).length;
      const symbols = (line.match(/[?@`~^]/g) || []).length;

      if (letters === 0 || symbols > letters) {
        firstPrintableIndex += 1;
        continue;
      }

      break;
    }

    return lines.slice(firstPrintableIndex).join('\n').trim();
  }

  static convertToMillimeters(value, unit) {
    const normalizedUnit = String(unit || 'millimeters').toLowerCase();
    const numericValue = Number.parseFloat(value) || 0;

    switch (normalizedUnit) {
      case 'inches':
        return numericValue * 25.4;
      case 'centimeters':
        return numericValue * 10;
      case 'pixels':
        return numericValue * (25.4 / 96);
      case 'millimeters':
      default:
        return numericValue;
    }
  }
}

export default ESCPosAdapter;
