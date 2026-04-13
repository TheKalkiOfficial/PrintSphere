import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RenderEngine } from '../core/renderEngine.js';
import ConfigStore from './configStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UI_DIR = path.join(__dirname, '..', 'ui');

export class HttpServer {
  constructor(PrintSphereServer, port = 3000) {
    this.PrintSphereServer = PrintSphereServer;
    this.port = port;
    this.server = null;
  }

  async start() {
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    return new Promise((resolve) => {
      this.server.listen(this.port, '0.0.0.0', () => {
        resolve();
      });
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(resolve);
      } else {
        resolve();
      }
    });
  }

  async handleRequest(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/api/jobs' && req.method === 'GET') {
      this.sendJson(res, 200, this.getJobsPayload());
      return;
    }

    if (req.url === '/api/status' && req.method === 'GET') {
      this.sendJson(res, 200, {
        running: this.PrintSphereServer.isRunning(),
        host: this.PrintSphereServer.config.host,
        tcpPort: this.PrintSphereServer.config.port,
      });
      return;
    }

    if (req.url === '/api/power' && req.method === 'POST') {
      try {
        const body = await this.readJsonBody(req);
        await this.setPowerState(Boolean(body.running));
        this.sendJson(res, 200, {
          running: this.PrintSphereServer.isRunning(),
          host: this.PrintSphereServer.config.host,
          tcpPort: this.PrintSphereServer.config.port,
        });
      } catch (error) {
        this.sendJson(res, 400, { error: error.message });
      }
      return;
    }

    if (req.url === '/api/settings' && req.method === 'GET') {
      this.sendJson(res, 200, this.PrintSphereServer.config);
      return;
    }

    if (req.url === '/api/settings' && req.method === 'PUT') {
      try {
        const body = await this.readJsonBody(req);
        await this.updateSettings(body);
        await ConfigStore.save(this.PrintSphereServer.config);
        this.sendJson(res, 200, this.PrintSphereServer.config);
      } catch (error) {
        this.sendJson(res, 400, { error: error.message });
      }
      return;
    }

    if (req.url === '/api/jobs' && req.method === 'DELETE') {
      this.PrintSphereServer.jobs.clear();
      this.sendJson(res, 200, { success: true });
      return;
    }

    if (req.url === '/api/test-print' && req.method === 'POST') {
      try {
        const body = await this.readJsonBody(req);
        const protocol = body.protocol ? String(body.protocol) : this.PrintSphereServer.config.protocolMode;
        const rawData = String(body.rawData || '');
        const job = await this.PrintSphereServer.processPrintSphereJob(
          rawData,
          this.PrintSphereServer.generateJobId(),
          { forcedLanguage: protocol }
        );

        this.sendJson(res, 200, {
          success: true,
          jobId: job.jobId,
          language: job.language,
          response: job.responseData ? Array.from(job.responseData.values()) : null,
        });
      } catch (error) {
        this.sendJson(res, 400, { error: error.message });
      }
      return;
    }

    this.serveStaticFile(req, res);
  }

  getJobsPayload() {
    const jobs = this.PrintSphereServer.getAllJobs().map((job) => {
      let svg = null;
      if (job.status === 'completed' && job.layout) {
        svg = RenderEngine.renderToSVG(job.layout);
      }

      return {
        jobId: job.jobId,
        language: job.language,
        timestamp: job.timestamp,
        status: job.status,
        svg,
        html: job.previewHtml,
      };
    });

    jobs.sort((a, b) => b.timestamp - a.timestamp);
    return jobs;
  }

  async readJsonBody(req) {
    return new Promise((resolve, reject) => {
      let rawBody = '';

      req.on('data', (chunk) => {
        rawBody += chunk.toString();
      });

      req.on('end', () => {
        if (!rawBody) {
          resolve({});
          return;
        }

        try {
          resolve(JSON.parse(rawBody));
        } catch {
          reject(new Error('Invalid JSON body'));
        }
      });

      req.on('error', reject);
    });
  }

  async updateSettings(body) {
    const config = this.PrintSphereServer.config;
    const runtimeChanges = {};

    if (body.host) {
      runtimeChanges.host = String(body.host);
    }

    if (body.port !== undefined) {
      runtimeChanges.port = Number.parseInt(body.port, 10) || config.port;
    }

    if (body.bufferSize !== undefined) {
      config.bufferSize = Number.parseInt(body.bufferSize, 10) || config.bufferSize;
    }

    if (body.keepTcpAlive !== undefined) {
      config.keepTcpAlive = Boolean(body.keepTcpAlive);
    }

    if (body.printDensity) {
      config.printDensity = String(body.printDensity);
    }

    if (body.unit) {
      config.unit = String(body.unit);
    }

    if (body.width !== undefined) {
      config.width = Number.parseInt(body.width, 10) || config.width;
    }

    if (body.height !== undefined) {
      config.height = Number.parseInt(body.height, 10) || config.height;
    }

    if (body.saveLabels !== undefined) {
      config.saveLabels = Boolean(body.saveLabels);
    }

    if (body.fileType) {
      config.fileType = String(body.fileType);
    }

    if (body.directoryPath !== undefined) {
      config.directoryPath = String(body.directoryPath);
    }

    if (body.languageMode) {
      config.languageMode = String(body.languageMode);
      config.protocolMode = String(body.languageMode);
    }

    if (body.zplStatus && typeof body.zplStatus === 'object') {
      config.zplStatus = {
        ...config.zplStatus,
        ...body.zplStatus,
      };
    }

    if (body.zplWarnings && typeof body.zplWarnings === 'object') {
      config.zplWarnings = {
        ...config.zplWarnings,
        ...body.zplWarnings,
      };
    }

    if (body.zplErrors && typeof body.zplErrors === 'object') {
      config.zplErrors = {
        ...config.zplErrors,
        ...body.zplErrors,
      };
    }

    if (body.escposStatus && typeof body.escposStatus === 'object') {
      config.escposStatus = {
        ...config.escposStatus,
        ...body.escposStatus,
      };
    }

    await this.PrintSphereServer.updateRuntimeConfig(runtimeChanges);
  }

  async setPowerState(shouldRun) {
    if (shouldRun) {
      await this.PrintSphereServer.start();
      return;
    }

    await this.PrintSphereServer.stop();
  }

  serveStaticFile(req, res) {
    const requestPath = req.url === '/' ? '/index.html' : req.url;
    const decodedPath = decodeURIComponent(requestPath);
    const hasTraversal = decodedPath.split(/[\\/]+/).includes('..');
    const normalizedPath = path.posix.normalize(decodedPath);

    if (hasTraversal) {
      this.sendText(res, 403, 'Forbidden');
      return;
    }

    const filePath = path.resolve(UI_DIR, `.${normalizedPath}`);
    const relativePath = path.relative(UI_DIR, filePath);

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      this.sendText(res, 403, 'Forbidden');
      return;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT') {
          this.sendText(res, 404, '404 Not Found');
        } else {
          this.sendText(res, 500, `Error ${error.code}`);
        }
        return;
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    });
  }

  sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  }

  sendText(res, statusCode, body) {
    res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
    res.end(body);
  }
}
