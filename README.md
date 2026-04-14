# PrintSphere | Universal Label Printer Emulator

**PrintSphere** is a high-performance, extensible label printer emulator designed for developers and systems integrators. It provides a visual, real-time preview of printer commands by emulating common protocols like **ZPL**, **TSPL**, **CPCL**, and **ESC/POS**.

Integrating a physical printer into your development workflow can be cumbersome. PrintSphere allows you to send raw printer data over TCP/IP and see the rendered result instantly in a web-based dashboard.

---

## 🎯 Key Features

- ✅ **Multi-Language Support**: Seamlessly handles ZPL (Zebra), TSPL (TSC), CPCL (Mobile), and ESC/POS (Receipts).
- ✅ **Real-Time Rendering**: High-fidelity SVG and HTML rendering of barcodes, QR codes, and text elements.
- ✅ **Dual-Server Architecture**:
  - **Printer Service (Port 9100)**: A TCP server that acts as a physical printer on your network.
  - **Web Dashboard (Port 3000)**: A modern UI for monitoring jobs, configuring settings, and manual testing.
- ✅ **Automatic Detection**: Intelligent routing that identifies the printer language from incoming raw data.
- ✅ **Extensible**: Built with an adapter pattern, making it easy to add support for additional printer languages.
- ✅ **Production-Ready**: Low latency, lightweight memory footprint, and comprehensive error handling.

---

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16.0.0 or higher)
- [npm](https://www.npmjs.com/)

### 2. Installation
Clone the repository and install dependencies:

```bash
git clone https://github.com/TheKalkiOfficial/PrintSphere.git
cd printsphere
npm install
```

### 3. Run the Emulator
Start both the TCP Printer Service and the Web Dashboard with a single command:

```bash
npm start
```

Once started, you will see output confirming the services are active:
- **Web Dashboard**: `http://localhost:3000`
- **TCP Printer Server**: Listening on configured host and port (see Settings to configure)

---

## 🖥️ Using the Dashboard

1. **Accessing the UI**: Open your browser and navigate to `http://localhost:3000`.
2. **Power Control**: Use the **ON/OFF** toggle in the top-right of the UI to start or stop the TCP Printer Service.
3. **Manual Testing**: Click the **Pencil icon** (Raw Test) to paste and render printer commands directly without needing a TCP client.
4. **Real-Time Feed**: The "Recent Jobs" sidebar will automatically populate as data is received on port 9100.

---

## 🔌 Connecting Your System

To send print jobs to PrintSphere, configure your application or printer driver with the following:

- **Host**: Configurable via Settings (Default: `127.0.0.1`, Network-accessible: `0.0.0.0`)
- **Port**: `9100` (or custom port configured in Settings)
- **Protocol**: Raw / TCP

**Note**: By default, the TCP server binds to `127.0.0.1` (localhost only). To make PrintSphere accessible to other devices on your network, go to **Settings (Gear Icon)** in the Web Dashboard and configure the host to `0.0.0.0`.

### Example (Node.js)
```javascript
import net from 'net';

const client = new net.Socket();
client.connect(9100, 'localhost', () => {
  client.write('^XA^PW800^LL600^FT100,100^A0@,30,20^FDPrintSphere^FS^XZ');
  client.destroy();
});
```

---

## 🏗️ Architecture

PrintSphere is built with a modular architecture focused on speed and correctness:

1. **TCP Listener**: Captures raw byte streams from clients.
2. **Language Detector**: Analyzes command markers (e.g., `^XA`, `SIZE`, `! 0`) to route data.
3. **Adapters**: Specialized parsers that convert raw commands into a **Unified Layout Model**.
4. **Render Engine**: Transforms the layout model into SVG or HTML for the web preview.

---

## 🛠️ Configuration

You can customize the emulator's behavior through the Web Dashboard's **Settings (Gear Icon)** or by editing `src/types.js`. Key settings include:
- **Print Density**: 6, 8, or 12 dpmm.
- **Save Labels**: Automatically persist rendered labels to a local directory.
- **TCP Keep-Alive**: Maintain connections for persistent redirector clients.

---

## 📝 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

**PrintSphere** - Reimagining label printer development. 🎨
