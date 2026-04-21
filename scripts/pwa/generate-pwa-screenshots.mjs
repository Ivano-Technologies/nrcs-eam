import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const outDir = path.resolve(process.cwd(), "client", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

function dashboardSvg(width, height) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#F8FAFC"/>
  <rect width="${width}" height="104" fill="#DC2626"/>
  <circle cx="66" cy="52" r="26" fill="#ffffff"/>
  <rect x="53" y="34" width="26" height="36" fill="#DC2626"/>
  <rect x="48" y="39" width="36" height="26" fill="#DC2626"/>
  <text x="110" y="44" fill="#ffffff" font-family="Arial, sans-serif" font-size="26" font-weight="700">Nigerian Red Cross Society</text>
  <text x="110" y="76" fill="#FEE2E2" font-family="Arial, sans-serif" font-size="18">Enterprise Asset Management</text>

  <rect x="48" y="140" width="278" height="140" rx="12" fill="#ffffff" stroke="#E2E8F0"/>
  <rect x="350" y="140" width="278" height="140" rx="12" fill="#ffffff" stroke="#E2E8F0"/>
  <rect x="652" y="140" width="278" height="140" rx="12" fill="#ffffff" stroke="#E2E8F0"/>
  <rect x="954" y="140" width="278" height="140" rx="12" fill="#ffffff" stroke="#E2E8F0"/>

  <text x="72" y="182" fill="#64748B" font-family="Arial, sans-serif" font-size="18">Total Assets</text>
  <text x="72" y="234" fill="#0F172A" font-family="Arial, sans-serif" font-size="42" font-weight="700">1,284</text>

  <text x="374" y="182" fill="#64748B" font-family="Arial, sans-serif" font-size="18">Open Work Orders</text>
  <text x="374" y="234" fill="#0F172A" font-family="Arial, sans-serif" font-size="42" font-weight="700">38</text>

  <text x="676" y="182" fill="#64748B" font-family="Arial, sans-serif" font-size="18">Low Stock Alerts</text>
  <text x="676" y="234" fill="#0F172A" font-family="Arial, sans-serif" font-size="42" font-weight="700">12</text>

  <text x="978" y="182" fill="#64748B" font-family="Arial, sans-serif" font-size="18">Facilities</text>
  <text x="978" y="234" fill="#0F172A" font-family="Arial, sans-serif" font-size="42" font-weight="700">72</text>

  <rect x="48" y="320" width="1184" height="340" rx="14" fill="#ffffff" stroke="#E2E8F0"/>
  <text x="72" y="360" fill="#0F172A" font-family="Arial, sans-serif" font-size="24" font-weight="700">Operational Overview</text>
  <rect x="72" y="390" width="1080" height="14" rx="7" fill="#E2E8F0"/>
  <rect x="72" y="390" width="760" height="14" rx="7" fill="#DC2626"/>
  <rect x="72" y="430" width="980" height="14" rx="7" fill="#E2E8F0"/>
  <rect x="72" y="430" width="610" height="14" rx="7" fill="#0A1628"/>
</svg>`;
}

function assetsSvg(width, height) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#F8FAFC"/>
  <rect width="${width}" height="104" fill="#DC2626"/>
  <text x="56" y="62" fill="#ffffff" font-family="Arial, sans-serif" font-size="30" font-weight="700">Asset Register</text>
  <rect x="40" y="132" width="1200" height="540" rx="12" fill="#ffffff" stroke="#E2E8F0"/>
  <rect x="40" y="132" width="1200" height="56" rx="12" fill="#0A1628"/>
  <text x="64" y="168" fill="#E2E8F0" font-family="Arial, sans-serif" font-size="16">S/No</text>
  <text x="144" y="168" fill="#E2E8F0" font-family="Arial, sans-serif" font-size="16">Asset Code</text>
  <text x="310" y="168" fill="#E2E8F0" font-family="Arial, sans-serif" font-size="16">Item Description</text>
  <text x="670" y="168" fill="#E2E8F0" font-family="Arial, sans-serif" font-size="16">Category</text>
  <text x="860" y="168" fill="#E2E8F0" font-family="Arial, sans-serif" font-size="16">Status</text>
  <text x="1020" y="168" fill="#E2E8F0" font-family="Arial, sans-serif" font-size="16">Facility</text>

  <g fill="#0F172A" font-family="Arial, sans-serif" font-size="15">
    <text x="66" y="222">1</text><text x="144" y="222">AST-00123</text><text x="310" y="222">Toyota Hilux Utility Vehicle</text><text x="670" y="222">Vehicles</text><text x="860" y="222">Operational</text><text x="1020" y="222">Abuja Warehouse</text>
    <text x="66" y="272">2</text><text x="144" y="272">AST-00124</text><text x="310" y="272">Generator 55kVA</text><text x="670" y="272">Power</text><text x="860" y="272">Maintenance</text><text x="1020" y="272">Lagos Depot</text>
    <text x="66" y="322">3</text><text x="144" y="322">AST-00125</text><text x="310" y="322">Cold Chain Refrigerator</text><text x="670" y="322">Medical</text><text x="860" y="322">Operational</text><text x="1020" y="322">Kano Branch</text>
    <text x="66" y="372">4</text><text x="144" y="372">AST-00126</text><text x="310" y="372">Mobile Water Tank</text><text x="670" y="372">Relief</text><text x="860" y="372">Operational</text><text x="1020" y="372">Maiduguri Hub</text>
  </g>
  <g stroke="#E2E8F0">
    <line x1="40" y1="198" x2="1240" y2="198" />
    <line x1="40" y1="248" x2="1240" y2="248" />
    <line x1="40" y1="298" x2="1240" y2="298" />
    <line x1="40" y1="348" x2="1240" y2="348" />
    <line x1="40" y1="398" x2="1240" y2="398" />
  </g>
</svg>`;
}

function mobileSvg(width, height) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#F8FAFC"/>
  <rect width="${width}" height="94" fill="#DC2626"/>
  <text x="24" y="44" fill="#ffffff" font-family="Arial, sans-serif" font-size="22" font-weight="700">NRCS EAM</text>
  <text x="24" y="70" fill="#FEE2E2" font-family="Arial, sans-serif" font-size="14">Mobile View</text>

  <rect x="18" y="112" width="504" height="80" rx="12" fill="#ffffff" stroke="#E2E8F0"/>
  <text x="36" y="145" fill="#0F172A" font-family="Arial, sans-serif" font-size="18" font-weight="700">Dashboard</text>
  <text x="36" y="168" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Quick metrics and alerts</text>

  <rect x="18" y="208" width="242" height="132" rx="12" fill="#ffffff" stroke="#E2E8F0"/>
  <rect x="280" y="208" width="242" height="132" rx="12" fill="#ffffff" stroke="#E2E8F0"/>
  <text x="34" y="244" fill="#64748B" font-family="Arial, sans-serif" font-size="14">Assets</text>
  <text x="34" y="292" fill="#0F172A" font-family="Arial, sans-serif" font-size="30" font-weight="700">1,284</text>
  <text x="296" y="244" fill="#64748B" font-family="Arial, sans-serif" font-size="14">Work Orders</text>
  <text x="296" y="292" fill="#0F172A" font-family="Arial, sans-serif" font-size="30" font-weight="700">38</text>

  <rect x="18" y="356" width="504" height="286" rx="12" fill="#ffffff" stroke="#E2E8F0"/>
  <text x="36" y="392" fill="#0F172A" font-family="Arial, sans-serif" font-size="18" font-weight="700">Recent Activity</text>
  <g stroke="#E2E8F0">
    <line x1="36" y1="418" x2="504" y2="418" />
    <line x1="36" y1="468" x2="504" y2="468" />
    <line x1="36" y1="518" x2="504" y2="518" />
    <line x1="36" y1="568" x2="504" y2="568" />
  </g>
</svg>`;
}

async function writePng(filename, svg, width, height) {
  const target = path.join(outDir, filename);
  await sharp(Buffer.from(svg)).png().resize(width, height).toFile(target);
}

await writePng("screenshot-desktop-1.png", dashboardSvg(1280, 720), 1280, 720);
await writePng("screenshot-desktop-2.png", assetsSvg(1280, 720), 1280, 720);
await writePng("screenshot-mobile-1.png", mobileSvg(540, 720), 540, 720);

console.log("Generated PWA screenshots in client/public/icons");
