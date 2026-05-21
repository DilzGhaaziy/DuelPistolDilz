import fs from 'fs';

if (!fs.existsSync('public')) {
  fs.mkdirSync('public', {recursive: true});
}

const response = await fetch('https://od.lk/s/NjhfMTY0NzQyMTEyXw/pistol-sound-effect.mp3');
const buffer = await response.arrayBuffer();
fs.writeFileSync('public/pistol.mp3', Buffer.from(buffer));
console.log('Download complete');
