import fs from 'fs/promises';
import path from 'path';

const CONFIG_DIR = path.resolve(process.cwd(), 'data');
const CONFIG_PATH = path.join(CONFIG_DIR, 'printer-config.json');

export class ConfigStore {
  static async load() {
    try {
      const raw = await fs.readFile(CONFIG_PATH, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  static async save(config) {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  }
}

export default ConfigStore;
