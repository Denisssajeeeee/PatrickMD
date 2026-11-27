import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PHOTO = path.join(__dirname, '..', '..', 'media', 'PatrickBOT.jpg');
const PLUGINS_DIR = path.join(__dirname, '..');

function runtime(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 86400)}d ${Math.floor(s % 86400 / 3600)}h ${Math.floor(s % 3600 / 60)}m ${s % 60}s`;
}

function countFiles(dir) {
    let total = 0;
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        if (item.name.startsWith('.')) continue;
        const full = path.join(dir, item.name);
        if (item.isDirectory()) total += countFiles(full);
        else if (item.name.endsWith('.js')) total++;
    }
    return total;
}

function countCommands(denn) {
    const set = new Set();
    const src = denn?.commands || denn?.plugins || globalThis.commands || globalThis.plugins;
    if (src) {
        if (src instanceof Map) {
            for (const k of src.keys()) set.add(k);
        } else if (Array.isArray(src)) {
            for (const p of src) {
                const cmds = p?.command || p?.commands || p?.name;
                if (Array.isArray(cmds)) cmds.forEach(c => set.add(c));
                else if (typeof cmds === 'string') set.add(cmds);
            }
        } else if (typeof src === 'object') {
            for (const k of Object.keys(src)) set.add(k);
        }
    }
    return set.size;
}

export default {
    command: ['info', 'botinfo', 'bot'],
    category: 'main',
    description: 'Informasi bot',
    execute: async (denn, m, { prefix }) => {
        const start = Date.now();
        const totalFiles = countFiles(PLUGINS_DIR);
        const totalCommands = countCommands(denn);
        const caption =
            `🤖 *INFO BOT*\n\n` +
            `⏱️ Runtime: ${runtime(process.uptime() * 1000)}\n` +
            `⚡ Speed: ${Date.now() - start}ms\n` +
            `📦 Total Plugin: ${totalFiles} file\n` +
            `⌨️ Total Command: ${totalCommands} command`;

        const buttons = [
            { buttonId: `${prefix}owner`, buttonText: { displayText: '👑 Owner' }, type: 1 },
            { buttonId: `${prefix}sc`, buttonText: { displayText: '📦 Script' }, type: 1 },
        ];
        if (fs.existsSync(PHOTO)) {
            await denn.sendMessage(m.chat, {
                image: fs.readFileSync(PHOTO),
                caption: caption,
                footer: 'DennCode • Bot WhatsApp',
                buttons: buttons,
                headerType: 4,
            }, { quoted: m });
        } else {
            console.log('[info] foto tidak ditemukan:', PHOTO);
            await denn.sendMessage(m.chat, {
                text: caption,
                footer: 'DennCode • Bot WhatsApp',
                buttons: buttons,
                headerType: 1,
            }, { quoted: m });
        }
    }
};