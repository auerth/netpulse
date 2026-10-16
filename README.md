# 🌐 softwelop NetPulse

Professional Network Monitoring Tool - Realtime Bandbreite- und Latenz-Messung mit interaktiven Dashboards.

NetPulse ist eine moderne Webanwendung zur kontinuierlichen Überwachung von Netzwerkperformance. Mit automatisierten Ping- und Speedtests sowie detaillierter Datenerfassung können Sie die Netzwerkqualität in Echtzeit analysieren.

## 🎯 Features

- **Automatisierte Ping-Tests**: Kontinuierliche Latenz-Messungen mit konfigurierbaren Intervallen
- **Speed-Tests**: Streaming-basierte Download-Geschwindigkeitsmessungen mit Live-Feedback
- **Echtzeit-Monitoring**: Live-Dashboard mit Geschwindigkeitsverlauf und Latenzdiagrammen
- **Datenerfassung**: Automatische Protokollierung aller Messwerte über mehrere Stunden
- **Detailanalyse**: Klickbare Charts mit detailliertem Geschwindigkeitsverlauf pro Test
- **CSV-Export**: Download aller Messwerte als CSV-Report
- **CDN-Integration**: Cloudflare-basierte Download-Presets (100MB, 500MB, 1GB)
- **Responsive Design**: Optimiert für Desktop und Mobile mit Tailwind CSS

## 🛠 Tech Stack

| Technologie | Version | Zweck |
|---|---|---|
| **React** | 19.2.0 | UI-Framework |
| **Vite** | 7.2.4 | Build Tool & Dev Server |
| **Recharts** | 3.5.1 | Datenvisualisierung |
| **Lucide React** | 0.555.0 | Icons |
| **Tailwind CSS** | 3.4.17 | Styling |
| **ESLint** | 9.39.1 | Code Linting |
| **PostCSS** | 8.5.6 | CSS Processing |

## 📦 Installation

Voraussetzung: Node.js 16+ und npm/yarn

```bash
# Repository clonen
git clone https://github.com/auerth/netpulse.git
cd netpulse

# Dependencies installieren
npm install
```

## 🚀 Verwendung

### Development Server
```bash
npm run dev
```
Öffnet die Anwendung unter `http://localhost:5173` mit Hot Module Replacement (HMR).

### Production Build
```bash
npm run build
```
Erstellt einen optimierten Build im `dist/`-Verzeichnis.

### Build Preview
```bash
npm run preview
```
Zeigt eine Vorschau des Production Builds.

### Linting
```bash
npm run lint
```
Prüft den Code auf ESLint-Regeln.

## 📋 Konfiguration

### Testparameter (UI-basiert)

- **Gesamtdauer**: 1-∞ Stunden Testdauer
- **Ping-Intervall**: 1-60 Sekunden zwischen Pings
- **Speed-Test-Intervall**: 1-60 Minuten zwischen Bandbreite-Tests

### Erweiterte Einstellungen

- **Ping URL**: Zielserver für Latenz-Tests (Standard: Google Favicon)
- **Download URL**: Test-Server für Speed-Tests mit Presets:
  - Cloudflare 100MB (Standard)
  - Cloudflare 500MB
  - Cloudflare 1GB

## 📊 Metriken

Das Dashboard zeigt in Echtzeit:

| Metrik | Beschreibung |
|---|---|
| **Durchschnitt Ping** | Mittlere Latenz in Millisekunden |
| **Paketverlust** | Anzahl fehlgeschlagener Ping-Requests |
| **Ø Download Speed** | Mittlere Bandbreite in Mbit/s |
| **Max/Min Speed** | Höchste und niedrigste gemessene Geschwindigkeit |

## 📈 Datenexport

Nach Tests können alle Messwerte als CSV exportiert werden:
```
Zeitstempel,Uhrzeit,Typ,Wert(ms_oder_mbps),Status
1732817245000,14:07:25,ping,32,ok
1732817247000,14:07:27,speed,125.4,ok
```

## 🎨 Design

- **Farbschema**: Professionell mit Fokus auf Lesbarkeit
  - Primär: #194093 (Dunkelblau)
  - Accent: #F18557 (Orange)
  - Gefahr: #E36150 (Rot)
- **Font**: Montserrat (Google Fonts)
- **Layout**: Responsive Grid-System mit Tailwind CSS

## 🔧 Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Browser (iOS Safari, Chrome Mobile)

## 🔒 Datenschutz

NetPulse läuft komplett im Browser, ohne Account und ohne Backend. Messwerte werden nur lokal gespeichert und nirgends hochgeladen. Für die Messung selbst verbindet sich der Browser mit externen Servern:

- **Ping**: standardmäßig das Favicon von google.com (in den Einstellungen änderbar)
- **Speedtest**: Testdateien von `speed.cloudflare.com`
- **Schrift**: Montserrat über Google Fonts

## 📝 Lizenz

[MIT](LICENSE) - © softwelop - Thorben Auer

## 👨‍💻 Autor

**softwelop - Thorben Auer** - [softwelop.com](https://softwelop.com/apps/netpulse.php) · [GitHub](https://github.com/auerth)

---

Für Fragen oder Bugs: GitHub Issues nutzen
