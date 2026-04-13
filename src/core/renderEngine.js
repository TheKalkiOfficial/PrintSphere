/**
 * Unified Rendering Engine - SVG/HTML Output
 */

import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

export class RenderEngine {
  static renderToSVG(layout) {
    const { width, height, elements } = layout;
    const viewBox = `0 0 ${width} ${height}`;

    let svg = `<svg viewBox="${viewBox}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">\n`;
    svg += `  <rect width="${width}" height="${height}" fill="white" stroke="black" stroke-width="2"/>\n`;

    for (const element of elements) {
      svg += RenderEngine.renderElement(element);
    }

    svg += '</svg>';
    return svg;
  }

  static renderElement(element) {
    let svg = '';

    switch (element.type) {
      case 'text':
        svg = RenderEngine.renderText(element);
        break;
      case 'barcode':
        svg = RenderEngine.renderBarcode(element);
        break;
      case 'qrcode':
        svg = RenderEngine.renderQRCode(element);
        break;
      case 'box':
        svg = RenderEngine.renderBox(element);
        break;
      case 'line':
        svg = RenderEngine.renderLine(element);
        break;
      default:
        svg = '';
    }

    return svg;
  }

  static renderText(element) {
    const { x, y, text, fontSize = 12, rotation = 0 } = element.props;
    const transform = rotation ? ` transform="rotate(${rotation} ${x} ${y})"` : '';
    return `  <text x="${x}" y="${y}" font-size="${fontSize}" fill="black"${transform}>${this.escapeXml(text)}</text>\n`;
  }

  static renderBarcode(element) {
    const {
      x,
      y,
      data,
      type = 'CODE128',
      height = 60,
      moduleWidth = 2,
      showText = true,
      fontSize = 12,
      rotation = 0,
    } = element.props;

    try {
      const barcodeData = {};
      JsBarcode(barcodeData, String(data || ''), {
        format: RenderEngine.normalizeBarcodeFormat(type),
        displayValue: false,
        margin: 0,
        width: Math.max(1, Number(moduleWidth) || 2),
        height: Math.max(20, Number(height) || 60),
      });

      const encoding = barcodeData.encodings?.[0];
      if (!encoding?.data) {
        throw new Error('Missing barcode encoding');
      }

      const bars = [];
      const barWidth = encoding.options.width;
      let cursor = 0;

      for (const bit of encoding.data) {
        if (bit === '1') {
          bars.push(
            `      <rect x="${cursor}" y="0" width="${barWidth}" height="${height}" fill="black"/>`
          );
        }
        cursor += barWidth;
      }

      const textY = height + fontSize + 2;
      const totalHeight = showText ? textY : height;
      const transform = rotation
        ? ` transform="translate(${x} ${y}) rotate(${rotation})"`
        : ` transform="translate(${x} ${y})"`;
      const caption = showText
        ? `\n      <text x="${cursor / 2}" y="${textY}" text-anchor="middle" font-size="${fontSize}" fill="black">${this.escapeXml(String(data || ''))}</text>`
        : '';

      return `  <g${transform} data-width="${cursor}" data-height="${totalHeight}">
${bars.join('\n')}${caption}
  </g>\n`;
    } catch {
      const fallbackWidth = Math.max(120, String(data || '').length * 12);
      return `  <rect x="${x}" y="${y}" width="${fallbackWidth}" height="${height}" fill="none" stroke="black" stroke-width="1"/>\n` +
             `  <text x="${x + 5}" y="${y + 18}" font-size="10">[BARCODE: ${this.escapeXml(String(data || ''))}]</text>\n`;
    }
  }

  static renderQRCode(element) {
    const { x, y, cellWidth = 5, data, level = 'M', rotation = 0 } = element.props;

    try {
      const qr = QRCode.create(String(data || ''), {
        errorCorrectionLevel: String(level || 'M').toUpperCase(),
      });
      const size = qr.modules.size * cellWidth;
      const cells = [];

      for (let row = 0; row < qr.modules.size; row += 1) {
        for (let col = 0; col < qr.modules.size; col += 1) {
          const index = row * qr.modules.size + col;
          if (qr.modules.data[index]) {
            cells.push(
              `      <rect x="${col * cellWidth}" y="${row * cellWidth}" width="${cellWidth}" height="${cellWidth}" fill="black"/>`
            );
          }
        }
      }

      const transform = rotation
        ? ` transform="translate(${x} ${y}) rotate(${rotation})"`
        : ` transform="translate(${x} ${y})"`;

      return `  <g${transform} data-width="${size}" data-height="${size}">
      <rect x="0" y="0" width="${size}" height="${size}" fill="white"/>
${cells.join('\n')}
  </g>\n`;
    } catch {
      const size = cellWidth * 21;
      return `  <rect x="${x}" y="${y}" width="${size}" height="${size}" fill="none" stroke="black" stroke-width="1"/>\n` +
             `  <text x="${x + 10}" y="${y + size / 2}" font-size="8">[QR: ${this.escapeXml(String(data || '').substring(0, 10))}...]</text>\n`;
    }
  }

  static renderBox(element) {
    const { x, y, width, height, thickness = 1 } = element.props;
    return `  <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="black" stroke-width="${thickness}"/>\n`;
  }

  static renderLine(element) {
    const { x1, y1, x2, y2, thickness = 1 } = element.props;
    return `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="black" stroke-width="${thickness}"/>\n`;
  }

  static escapeXml(str) {
    if (!str) return '';
    return str.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case "'": return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }

  static normalizeBarcodeFormat(type) {
    const normalized = String(type || 'CODE128').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    const aliasMap = {
      '128': 'CODE128',
      CODE128AUTO: 'CODE128',
      CODE128M: 'CODE128',
      CODE39: 'CODE39',
      39: 'CODE39',
      EAN13: 'EAN13',
      EAN8: 'EAN8',
      UPCA: 'UPC',
      UPCA: 'UPC',
      UPCE: 'UPC',
      ITF14: 'ITF14',
      ITF: 'ITF14',
      CODABAR: 'codabar',
    };

    return aliasMap[normalized] || normalized || 'CODE128';
  }
}
