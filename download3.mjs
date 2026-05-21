import fs from 'fs';

async function download() {
  if (!fs.existsSync('public')) {
    fs.mkdirSync('public', {recursive: true});
  }

  const files = [
    { url: 'https://od.lk/s/NjhfMTY0NzQyNzg1Xw/swoosh2222.mp3', name: 'public/slowmo.mp3' }
  ];

  for (const f of files) {
    console.log('Downloading', f.name);
    const response = await fetch(f.url);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(f.name, Buffer.from(buffer));
    console.log('Downloaded', f.name);
  }
}

download().catch(console.error);
