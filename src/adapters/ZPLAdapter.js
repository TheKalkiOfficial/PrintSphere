/**
 * ZPL Adapter - Zebra Printer Language Support
 */

import { PrintSphereElement, LabelLayout } from '../types.js';

export class ZPLAdapter {
  static parse(rawData) {
    const layout = new LabelLayout(800, 600, 203);
    const lines = ZPLAdapter.tokenize(rawData);
    let currentX = 0, currentY = 0;
    let currentFont = 'A';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        if (trimmed === '^XA') {
          layout.clear();
        } else if (trimmed.startsWith('^PW')) {
          const match = trimmed.match(/\^PW(\d+)/);
          if (match) layout.width = parseInt(match[1]);
        } else if (trimmed.startsWith('^LL')) {
          const match = trimmed.match(/\^LL(\d+)/);
          if (match) layout.height = parseInt(match[1]);
        } else if (trimmed.startsWith('^FT')) {
          const match = trimmed.match(/\^FT(\d+),(\d+)/);
          if (match) {
            currentX = parseInt(match[1]);
            currentY = parseInt(match[2]);
          }
        } else if (trimmed.startsWith('^A')) {
          const match = trimmed.match(/\^A([A-Z])@/);
          if (match) currentFont = match[1];
        } else if (trimmed.startsWith('^FD')) {
          const match = trimmed.match(/\^FD(.+?)(?:\^FS)?$/);
          if (match) {
            const text = match[1];
            layout.addElement(
              new PrintSphereElement('text', {
                x: currentX,
                y: currentY,
                text: text,
                font: currentFont,
                fontSize: 12,
              })
            );
          }
        }
      } catch (error) {
        console.warn(`ZPL Parse warning: ${error.message}`);
      }
    }

    return {
      success: true,
      layout,
      elementCount: layout.elements.length,
    };
  }

  static tokenize(rawData) {
    return rawData
      .replace(/\r/g, '\n')
      .split(/\n+/)
      .flatMap((line) => line.match(/\^[A-Z0-9][^^]*/gi) || [])
      .map((token) => token.trim())
      .filter(Boolean);
  }
}

export default ZPLAdapter;
