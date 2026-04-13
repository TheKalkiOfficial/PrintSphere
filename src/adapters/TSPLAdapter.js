/**
 * TSPL Adapter - TSC/Impact Printer Language Support
 */

import { PrintSphereElement, LabelLayout } from '../types.js';

export class TSPLAdapter {
  static parse(rawData) {
    const lines = rawData.split('\n').map((l) => l.trim()).filter((l) => l);
    const layout = new LabelLayout(800, 600, 203);

    for (const line of lines) {
      try {
        if (line.startsWith('SIZE')) {
          const match = line.match(/SIZE\s+(\d+)\s*,\s*(\d+)/i);
          if (match) {
            layout.width = parseInt(match[1]) * 8;
            layout.height = parseInt(match[2]) * 8;
          }
        } else if (line.startsWith('GAP')) {
          const match = line.match(/GAP\s+(\d+)/i);
          if (match) layout.gap = parseInt(match[1]);
        } else if (line.startsWith('CLS')) {
          layout.clear();
        } else if (line.startsWith('TEXT')) {
          const element = TSPLAdapter.parseText(line);
          if (element) layout.addElement(element);
        } else if (line.startsWith('BARCODE')) {
          const element = TSPLAdapter.parseBarcode(line);
          if (element) layout.addElement(element);
        } else if (line.startsWith('QRCODE')) {
          const element = TSPLAdapter.parseQRCode(line);
          if (element) layout.addElement(element);
        } else if (line.startsWith('BOX')) {
          const element = TSPLAdapter.parseBox(line);
          if (element) layout.addElement(element);
        } else if (line.startsWith('PRINT')) {
          break;
        }
      } catch (error) {
        console.warn(`TSPL Parse warning: ${error.message}`);
      }
    }

    return {
      success: true,
      layout,
      elementCount: layout.elements.length,
    };
  }

  static parseText(line) {
    const parts = TSPLAdapter.splitArguments(line.replace(/^TEXT\s+/i, ''));
    if (parts.length >= 3) {
      return new PrintSphereElement('text', {
        x: parseInt(parts[0], 10) || 0,
        y: parseInt(parts[1], 10) || 0,
        text: parts[parts.length - 1] ? parts[parts.length - 1].replace(/^"|"$/g, '') : '',
        font: 'Arial',
        fontSize: 12,
      });
    }
    return null;
  }

  static parseBarcode(line) {
    const parts = TSPLAdapter.splitArguments(line.replace(/^BARCODE\s+/i, ''));
    if (parts.length < 8) {
      return null;
    }

    const [x, y, type, height, humanReadable, rotation, narrow, wide, ...rest] = parts;
    const data = rest[rest.length - 1];
    return new PrintSphereElement('barcode', {
      x: parseInt(x, 10) || 0,
      y: parseInt(y, 10) || 0,
      type: type.replace(/^"|"$/g, ''),
      data: String(data || '').replace(/^"|"$/g, ''),
      height: parseInt(height, 10) || 50,
      rotation: parseInt(String(rotation).replace(/"/g, ''), 10) || 0,
      moduleWidth: Math.max(1, parseInt(narrow, 10) || 2),
      wideWidth: Math.max(1, parseInt(wide, 10) || 2),
      showText: /^(YES|Y|B|1)$/i.test(String(humanReadable).replace(/"/g, '')),
      fontSize: 12,
    });
  }

  static parseQRCode(line) {
    const parts = TSPLAdapter.splitArguments(line.replace(/^QRCODE\s+/i, ''));
    if (parts.length < 7) {
      return null;
    }

    const [x, y, level, cellWidth, mode, rotation, data] = parts;
    return new PrintSphereElement('qrcode', {
      x: parseInt(x, 10) || 0,
      y: parseInt(y, 10) || 0,
      data: data.replace(/^"|"$/g, ''),
      level: String(level || 'M').replace(/"/g, ''),
      cellWidth: Math.max(2, parseInt(cellWidth, 10) || 4),
      mode: String(mode || '').replace(/"/g, ''),
      rotation: parseInt(String(rotation).replace(/"/g, ''), 10) || 0,
    });
  }

  static parseBox(line) {
    const parts = TSPLAdapter.splitArguments(line.replace(/^BOX\s+/i, ''));
    if (parts.length >= 5) {
      return new PrintSphereElement('box', {
        x: parseInt(parts[0], 10) || 0,
        y: parseInt(parts[1], 10) || 0,
        width: parseInt(parts[2], 10) || 0,
        height: parseInt(parts[3], 10) || 0,
        thickness: parseInt(parts[4], 10) || 1,
      });
    }
    return null;
  }

  static splitArguments(value) {
    return value
      .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
}

export default TSPLAdapter;
