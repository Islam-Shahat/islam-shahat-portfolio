const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// SVG code with bold, high-contrast, beautiful ISS7 typography and emerald gradient
const svgCode = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#081711"/>
      <stop offset="40%" stop-color="#0e2a1f"/>
      <stop offset="100%" stop-color="#040b08"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.95"/>
      <stop offset="50%" stop-color="#06b6d4" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#10b981" stop-opacity="0.95"/>
    </linearGradient>
    <linearGradient id="textGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
  </defs>

  <!-- Rounded Squircle Base -->
  <rect x="18" y="18" width="476" height="476" rx="108" fill="url(#bgGrad)" stroke="url(#borderGrad)" stroke-width="20"/>

  <!-- Radial subtle emerald light aura -->
  <circle cx="256" cy="256" r="170" fill="#10b981" opacity="0.14"/>

  <!-- Brand Typography: ISS7 -->
  <text x="256" y="322" 
        font-family="system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" 
        font-size="166" 
        font-weight="900" 
        letter-spacing="2" 
        text-anchor="middle">
    <tspan fill="url(#textGrad)">ISS</tspan><tspan fill="url(#accentGrad)">7</tspan>
  </text>
</svg>`;

async function generate() {
  const targetDir = path.join(__dirname, '../../client/assets/img/favicon_io');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 1. Save SVG
  fs.writeFileSync(path.join(targetDir, 'favicon.svg'), svgCode, 'utf8');

  const svgBuffer = Buffer.from(svgCode);

  // 2. Generate PNGs
  const p512 = await sharp(svgBuffer).resize(512, 512).png().toBuffer();
  fs.writeFileSync(path.join(targetDir, 'android-chrome-512x512.png'), p512);

  const p192 = await sharp(svgBuffer).resize(192, 192).png().toBuffer();
  fs.writeFileSync(path.join(targetDir, 'android-chrome-192x192.png'), p192);

  const p180 = await sharp(svgBuffer).resize(180, 180).png().toBuffer();
  fs.writeFileSync(path.join(targetDir, 'apple-touch-icon.png'), p180);

  const p48 = await sharp(svgBuffer).resize(48, 48).png().toBuffer();

  const p32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  fs.writeFileSync(path.join(targetDir, 'favicon-32x32.png'), p32);

  const p16 = await sharp(svgBuffer).resize(16, 16).png().toBuffer();
  fs.writeFileSync(path.join(targetDir, 'favicon-16x16.png'), p16);

  // 3. Build multi-resolution ICO file (16, 32, 48)
  const images = [
    { size: 16, buffer: p16 },
    { size: 32, buffer: p32 },
    { size: 48, buffer: p48 }
  ];

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(images.length, 4); // count of images

  let offset = 6 + (images.length * 16);
  const entries = [];
  const buffers = [];

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.size, 0); // width
    entry.writeUInt8(img.size, 1); // height
    entry.writeUInt8(0, 2); // color palette (0 = no palette)
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // image size in bytes
    entry.writeUInt32LE(offset, 12); // image offset from start of file

    entries.push(entry);
    buffers.push(img.buffer);
    offset += img.buffer.length;
  }

  const icoBuffer = Buffer.concat([header, ...entries, ...buffers]);
  fs.writeFileSync(path.join(targetDir, 'favicon.ico'), icoBuffer);

  console.log('✅ Generated favicon.svg');
  console.log('✅ Generated favicon-16x16.png');
  console.log('✅ Generated favicon-32x32.png');
  console.log('✅ Generated apple-touch-icon.png');
  console.log('✅ Generated android-chrome-192x192.png');
  console.log('✅ Generated android-chrome-512x512.png');
  console.log('✅ Generated multi-resolution favicon.ico');
}

generate().catch(err => {
  console.error('Generation failed:', err);
  process.exit(1);
});
