/**
 * CPCL Adapter - Mobile/Thermal Printer Language Support
 */

import { PrintSphereElement, LabelLayout } from '../types.js';

export class CPCLAdapter {
  static parse(rawData) {
    const lines = rawData.split('\n').map((l) => l.trim()).filter((l) => l);
    const layout = new LabelLayout(480, 800, 203);

    for (const line of lines) {
      try {
        if (line.startsWith('! 0') || line.startsWith('! 1')) {
          continue;
        } else if (line.startsWith('PAGE-WIDTH')) {
          const match = line.match(/PAGE-WIDTH\s+(\d+)/i);
          if (match) layout.width = parseInt(match[1]);
        } else if (line.startsWith('PAGE-HEIGHT')) {
          const match = line.match(/PAGE-HEIGHT\s+(\d+)/i);
          if (match) layout.height = parseInt(match[1]);
        } else if (line.startsWith('TEXT')) {
          const element = CPCLAdapter.parseText(line);
          if (element) layout.addElement(element);
        } else if (line.startsWith('BARCODE')) {
          const element = CPCLAdapter.parseBarcode(line);
          if (element) layout.addElement(element);
        } else if (line.startsWith('QR')) {
          const element = CPCLAdapter.parseQR(line);
          if (element) layout.addElement(element);
        } else if (line.startsWith('BOX')) {
          const element = CPCLAdapter.parseBox(line);
          if (element) layout.addElement(element);
        } else if (line.startsWith('LINE')) {
          const element = CPCLAdapter.parseLine(line);
          if (element) layout.addElement(element);
        } else if (line.startsWith('PRINT')) {
          break;
        }
      } catch (error) {
        console.warn(`CPCL Parse warning: ${error.message}`);
      }
    }

    return {
      success: true,
      layout,
      elementCount: layout.elements.length,
    };
  }

  static parseText(line) {
    const parts = CPCLAdapter.splitArguments(line.replace(/^TEXT\s+/i, ''));
    if (parts.length >= 6) {
      return new PrintSphereElement('text', {
        x: parseInt(parts[0], 10) || 0,
        y: parseInt(parts[1], 10) || 0,
        text: parts[parts.length - 1] ? parts[parts.length - 1].replace(/^"|"$/g, '') : '',
        font: 'Arial',
        fontSize: 11,
      });
    }
    return null;
  }

  static parseBarcode(line) {
    const parts = CPCLAdapter.splitArguments(line.replace(/^BARCODE\s+/i, ''));
    if (parts.length < 6) {
      return null;
    }

    return new PrintSphereElement('barcode', {
      x: parseInt(parts[0], 10) || 0,
      y: parseInt(parts[1], 10) || 0,
      type: (parts[2] || 'CODE128').replace(/^"|"$/g, ''),
      height: parseInt(parts[3], 10) || 40,
      moduleWidth: 2,
      showText: true,
      data: (parts[parts.length - 1] || '').replace(/^"|"$/g, ''),
    });
  }

  static parseQR(line) {
    const parts = CPCLAdapter.splitArguments(line.replace(/^QR\s+/i, ''));
    if (parts.length < 5) {
      return null;
    }

    return new PrintSphereElement('qrcode', {
      x: parseInt(parts[0], 10) || 0,
      y: parseInt(parts[1], 10) || 0,
      level: (parts[2] || 'M').replace(/"/g, ''),
      cellWidth: Math.max(2, parseInt(parts[3], 10) || 4),
      data: (parts[4] || '').replace(/^"|"$/g, ''),
    });
  }

  static parseBox(line) {
    const parts = line.split(',');
    if (parts.length >= 5) {
      return new PrintSphereElement('box', {
        x: parseInt(parts[1]) || 0,
        y: parseInt(parts[2]) || 0,
        width: parseInt(parts[3]) || 0,
        height: parseInt(parts[4]) || 0,
        thickness: 2,
      });
    }
    return null;
  }

  static parseLine(line) {
    const parts = line.split(',');
    if (parts.length >= 5) {
      return new PrintSphereElement('line', {
        x1: parseInt(parts[1]) || 0,
        y1: parseInt(parts[2]) || 0,
        x2: parseInt(parts[3]) || 0,
        y2: parseInt(parts[4]) || 0,
        thickness: 2,
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

export default CPCLAdapter;
