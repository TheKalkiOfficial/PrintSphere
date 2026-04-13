#!/usr/bin/env node

/**
 * PrintSphere - Main Entry Point
 * Supports: ZPL, TSPL, CPCL, ESC/POS
 */

import { PrintSphereServer } from './server/PrintSphereServer.js';
import { HttpServer } from './server/HttpServer.js';
import ConfigStore from './server/configStore.js';
import { PrintSphereConfig } from './types.js';

async function main() {
  const config = new PrintSphereConfig();
  const persisted = await ConfigStore.load();
  if (persisted) {
    Object.assign(config, persisted);
  }
  config.port = process.env.PORT || 9100;
  config.logLevel = process.env.LOG_LEVEL || 'info';

  console.log('============================================================');
  console.log('   PrintSphere v1.0.0');
  console.log('   ZPL | TSPL | CPCL | ESC/POS Support');
  console.log('============================================================\n');

  try {
    const server = new PrintSphereServer(config);
    const httpServer = new HttpServer(server, 3000);
    await httpServer.start();

    console.log(`Web Dashboard started on http://localhost:3000`);
    console.log(`TCP Printer Server is waiting for UI power-on`);
    console.log('\nSupported languages:');
    console.log('  - ZPL   (Zebra printers)');
    console.log('  - TSPL  (TSC/Impact printers)');
    console.log('  - CPCL  (Mobile/Thermal printers)');
    console.log('  - ESC/POS (Receipt printers)\n');

    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await httpServer.stop();
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start application:', error.message);
    process.exit(1);
  }
}

main();
