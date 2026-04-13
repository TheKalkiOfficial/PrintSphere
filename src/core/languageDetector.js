/**
 * Language Detection and Routing Module
 */

export class LanguageDetector {
  static detect(rawData) {
    if (!rawData || rawData.length === 0) {
      return { language: 'unknown', confidence: 0 };
    }

    const dataStr = typeof rawData === 'string' ? rawData : rawData.toString();
    const trimmed = dataStr.trim();

    // ZPL detection: starts with ^XA
    if (trimmed.startsWith('^XA')) {
      return { language: 'ZPL', confidence: 0.99, marker: '^XA' };
    }

    // TSPL detection: SIZE, GAP, CLS, PRINT keywords
    const tsplPatterns = [/^SIZE\s+\d+/m, /^GAP\s+\d+/m, /^CLS/m, /^PRINT/m];
    const tsplMatches = tsplPatterns.filter((p) => p.test(trimmed)).length;
    if (tsplMatches >= 2) {
      return { language: 'TSPL', confidence: 0.95, matchCount: tsplMatches };
    }

    // CPCL detection: starts with ! 0 or ! 1
    if (/^!\s*[01]/.test(trimmed)) {
      return { language: 'CPCL', confidence: 0.99, marker: '! 0/1' };
    }

    // ESC/POS detection: common control prefixes or binary receipt content
    if (/[\x1b\x1d\x10]/.test(dataStr)) {
      return { language: 'ESC/POS', confidence: 0.8, marker: 'ESC/POS control bytes' };
    }

    return { language: 'unknown', confidence: 0, sample: trimmed.substring(0, 50) };
  }
}

export class LanguageRouter {
  constructor(adapters = {}) {
    this.adapters = adapters;
  }

  registerAdapter(language, adapter) {
    this.adapters[language.toUpperCase()] = adapter;
  }

  async route(rawData) {
    const detection = LanguageDetector.detect(rawData);
    const { language } = detection;

    if (!this.adapters[language]) {
      throw new Error(`No adapter found for language: ${language}`);
    }

    const adapter = this.adapters[language];
    return { language, detection, adapter };
  }
}
