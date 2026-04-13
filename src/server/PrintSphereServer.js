/**
 * TCP Printer Server
 * Listens on port 9100 for incoming print jobs
 */

import net from 'net';
import fs from 'fs/promises';
import path from 'path';
import { LanguageDetector, LanguageRouter } from '../core/languageDetector.js';
import EscPosCommands from '../core/escposCommands.js';
import { PrintSphereJob, PrintSphereConfig } from '../types.js';
import ESCPosAdapter from '../adapters/ESCPosAdapter.js';
import ZPLAdapter from '../adapters/ZPLAdapter.js';
import TSPLAdapter from '../adapters/TSPLAdapter.js';
import CPCLAdapter from '../adapters/CPCLAdapter.js';
import { RenderEngine } from '../core/renderEngine.js';

export class PrintSphereServer {
  constructor(config = new PrintSphereConfig()) {
    this.config = config;
    this.server = null;
    this.jobs = new Map();

    this.router = new LanguageRouter({
      ZPL: ZPLAdapter,
      TSPL: TSPLAdapter,
      CPCL: CPCLAdapter,
      'ESC/POS': ESCPosAdapter,
    });
    this.escposCommands = new EscPosCommands(this.config);
  }

  async start() {
    if (this.server?.listening) {
      return;
    }

    this.server = net.createServer((socket) => {
      this.handleConnection(socket);
    });

    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host || '0.0.0.0', () => {
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async updateRuntimeConfig(nextConfig) {
    const shouldRestart =
      nextConfig.port !== undefined && Number(nextConfig.port) !== Number(this.config.port) ||
      nextConfig.host !== undefined && String(nextConfig.host) !== String(this.config.host);

    Object.assign(this.config, nextConfig);

    if (shouldRestart && this.server) {
      await this.stop();
      await this.start();
    }
  }

  handleConnection(socket) {
    const state = {
      buffer: Buffer.alloc(0),
      bytesReceived: 0,
      ended: false,
      jobsProcessed: 0,
      processing: false,
    };

    const peer = `${socket.remoteAddress || 'unknown'}:${socket.remotePort || 'unknown'}`;

    socket.setKeepAlive(Boolean(this.config.keepTcpAlive));

    socket.on('data', (data) => {
      state.bytesReceived += data.length;
      state.buffer = Buffer.concat([state.buffer, data]);
      void this.drainBuffer(socket, state);
    });

    socket.on('end', () => {
      state.ended = true;
      void this.flushRemainingBuffer(socket, state);
      if (state.bytesReceived > 0 || state.jobsProcessed > 0) {
        console.log(
          `[TCP] Client disconnected ${peer} (${state.bytesReceived} bytes, ${state.jobsProcessed} job${state.jobsProcessed === 1 ? '' : 's'})`
        );
      }
    });

    socket.on('error', (error) => {
      console.error(`Socket error: ${error.message}`);
    });
  }

  async drainBuffer(socket, state) {
    if (state.processing) {
      return;
    }

    state.processing = true;

    try {
      let extraction = this.extractCompleteJobs(state.buffer);

      while (extraction.jobs.length > 0) {
        state.buffer = extraction.remainder;

        for (const rawJob of extraction.jobs) {
          const jobId = this.generateJobId();
          try {
            const job = await this.processPrintSphereJob(rawJob, jobId);
            state.jobsProcessed += 1;
            if (job.responseData) {
              socket.write(job.responseData);
            } else {
              socket.write('OK\n');
            }
          } catch (error) {
            socket.write(`ERROR: ${error.message}\n`);
          }
        }

        extraction = this.extractCompleteJobs(state.buffer);
      }
    } finally {
      state.processing = false;
      if (state.ended && state.buffer.length > 0) {
        void this.flushRemainingBuffer(socket, state);
      }
    }
  }

  async flushRemainingBuffer(socket, state) {
    if (state.processing) {
      return;
    }

    if (!state.buffer.length) {
      return;
    }

    const leftover = state.buffer;

    if (!this.isCompleteJob(leftover)) {
      socket.write('ERROR: Incomplete print job\n');
      state.buffer = Buffer.alloc(0);
      return;
    }

    state.buffer = Buffer.alloc(0);
    const jobId = this.generateJobId();

    try {
      const job = await this.processPrintSphereJob(leftover, jobId);
      state.jobsProcessed += 1;
      if (job.responseData) {
        socket.write(job.responseData);
      } else {
        socket.write('OK\n');
      }
    } catch (error) {
      socket.write(`ERROR: ${error.message}\n`);
    }
  }

  extractCompleteJobs(buffer) {
    if (!Buffer.isBuffer(buffer)) {
      buffer = Buffer.from(typeof buffer === 'string' ? buffer : String(buffer || ''), 'latin1');
    }

    const jobs = [];
    let working = buffer;

    while (working.length > 0) {
      const trimmedText = working.toString('latin1').trimStart();
      if (!trimmedText) {
        break;
      }

      const fullText = working.toString('latin1');
      const offset = fullText.length - trimmedText.length;
      const trimmed = working.subarray(offset);
      const trimmedStr = trimmed.toString('latin1');
      const detection = this.detectLanguage(trimmed);

      if (detection.language === 'ZPL') {
        const endIndex = trimmedStr.indexOf('^XZ');
        if (endIndex === -1) {
          break;
        }

        const jobEnd = offset + endIndex + 3;
        jobs.push(working.slice(offset, jobEnd));
        working = working.slice(jobEnd);
        continue;
      }

      if (detection.language === 'TSPL' || detection.language === 'CPCL') {
        const match = trimmedStr.match(/(?:^|\r?\n)PRINT(?:\s+\d+\s*,\s*\d+)?(?:\r?\n|$)/i);
        if (!match) {
          break;
        }

        const jobEnd = offset + match.index + match[0].length;
        jobs.push(working.slice(offset, jobEnd));
        working = working.slice(jobEnd);
        continue;
      }

      if (detection.language === 'ESC/POS') {
        break;
      }

      break;
    }

    return { jobs, remainder: working };
  }

  isCompleteJob(rawData) {
    const detection = this.detectLanguage(rawData);

    if (detection.language === 'ZPL') {
      return rawData.includes('^XZ');
    }

    if (detection.language === 'TSPL' || detection.language === 'CPCL') {
      return /(?:^|\r?\n)PRINT(?:\s+\d+\s*,\s*\d+)?(?:\r?\n|$)/i.test(rawData);
    }

    if (detection.language === 'ESC/POS') {
      return rawData.length > 0;
    }

    return false;
  }

  async processPrintSphereJob(rawData, jobId, options = {}) {
    const startTime = Date.now();
    const detection = this.detectLanguage(rawData, options.forcedLanguage);
    const { language } = detection;

    if (language === 'unknown') {
      throw new Error('Unknown printer language');
    }

    const job = new PrintSphereJob(jobId, language, rawData);

    try {
      if (language === 'ESC/POS' && this.escposCommands.matchCommand(job.rawData)) {
        job.status = 'completed';
        job.responseData = this.escposCommands.getResponse(job.rawData);
        this.jobs.set(jobId, job);
        return job;
      }

      if (language === 'ESC/POS') {
        const parseStart = Date.now();
        const result = ESCPosAdapter.parse(job.rawBuffer);
        job.parseTime = Date.now() - parseStart;
        job.layout = result.layout;
        job.previewHtml = await ESCPosAdapter.renderHtml(job.rawBuffer, this.config);
        job.status = 'completed';
        job.renderTime = Date.now() - startTime - job.parseTime;

        console.log(`\n[OK] Job ${jobId}`);
        console.log(`  Language: ${language}`);
        console.log(`  Elements: ${result.elementCount}`);
        console.log(`  Parse Time: ${job.parseTime}ms`);
        console.log(`  Total Time: ${Date.now() - startTime}ms`);

        this.jobs.set(jobId, job);
        return job;
      }

      let adapter = this.router.adapters[language];
      if (!adapter) {
        const route = await this.router.route(rawData);
        adapter = route.adapter;
      }

      const parseStart = Date.now();
      const result = adapter.parse(job.rawData);
      job.parseTime = Date.now() - parseStart;

      if (result.success) {
        job.layout = result.layout;
        job.status = 'completed';

        const svg = RenderEngine.renderToSVG(job.layout);
        job.renderTime = Date.now() - parseStart - job.parseTime;
        await this.persistJobArtifacts(job, svg);

        console.log(`\n[OK] Job ${jobId}`);
        console.log(`  Language: ${language}`);
        console.log(`  Elements: ${result.elementCount}`);
        console.log(`  Parse Time: ${job.parseTime}ms`);
        console.log(`  Total Time: ${Date.now() - startTime}ms`);

        this.jobs.set(jobId, job);
      } else {
        job.status = 'error';
        job.error = 'Parse failed';
        this.jobs.set(jobId, job);
      }
    } catch (error) {
      job.status = 'error';
      job.error = error.message;
      this.jobs.set(jobId, job);
      throw error;
    }

    return job;
  }

  generateJobId() {
    return `JOB-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  getAllJobs() {
    return Array.from(this.jobs.values());
  }

  isRunning() {
    return Boolean(this.server?.listening);
  }

  detectLanguage(rawData, forcedLanguage = null) {
    if (forcedLanguage) {
      return { language: forcedLanguage, confidence: 1, marker: 'forced' };
    }

    const detected = LanguageDetector.detect(rawData);

    if (detected.language !== 'unknown') {
      return detected;
    }

    if (this.config.protocolMode === 'ESC/POS' && ESCPosAdapter.toBuffer(rawData).length > 0) {
      return { language: 'ESC/POS', confidence: 0.5, marker: 'protocolMode fallback' };
    }

    return detected;
  }

  async persistJobArtifacts(job, svg) {
    if (!this.config.saveLabels || !this.config.directoryPath) {
      return;
    }

    await fs.mkdir(this.config.directoryPath, { recursive: true });

    const safeJobId = job.jobId.replace(/[^\w.-]/g, '_');
    const fileType = (this.config.fileType || 'svg').toLowerCase();
    const filePath = path.join(this.config.directoryPath, `${safeJobId}.${fileType}`);

    if (fileType === 'json') {
      await fs.writeFile(filePath, JSON.stringify(job.layout.toJSON(), null, 2), 'utf8');
      return;
    }

    if (fileType === 'txt' || fileType === 'zpl') {
      await fs.writeFile(filePath, job.rawBuffer);
      return;
    }

    await fs.writeFile(filePath, svg, 'utf8');
  }
}
