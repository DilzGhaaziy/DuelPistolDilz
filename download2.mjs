import fs from 'fs';

async function download() {
  if (!fs.existsSync('public')) {
    fs.mkdirSync('public', {recursive: true});
  }

  const files = [
    { url: 'https://od.lk/s/NjhfMTY0NzQyNDQ5Xw/bat_hit.mp3', name: 'public/hit.mp3' },
    { url: 'https://od.lk/s/NjhfMTY0NzQyMTkyXw/soulja-boy-hit-sound.mp3', name: 'public/death.mp3' },
    { url: 'https://od.lk/s/NjhfMTY0NzQyMzM2Xw/deep-swoosh.mp3', name: 'public/slowmo.mp3' },
    { url: 'https://od.lk/s/NjhfMTY0NzQyMzk3Xw/metal04gr-converted.mp3', name: 'public/bullet_collide.mp3' }
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
