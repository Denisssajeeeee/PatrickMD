import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendFakeQuoted } from '../../lib/fakequoted.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGINS_DIR = path.resolve(__dirname, '..');

const listFiles = (dir, base = '') => {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const relPath = base ? `${base}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            results.push(...listFiles(path.join(dir, entry.name), relPath));
        } else if (entry.name.endsWith('.js')) {
            results.push(relPath);
        }
    }
    return results;
};

const normalizeInput = (input) => {
    let s = String(input || '').trim();
    s = s.replace(/^\/+/, '').replace(/\\/g, '/');
    s = s.replace(/^plugins\//i, '');
    s = s.replace(/^\.\//, '');
    if (s && !s.endsWith('.js')) s += '.js';
    return s;
};

const resolvePluginPath = (input) => {
    const normalized = normalizeInput(input);
    if (!normalized) return null;
    const target = path.resolve(PLUGINS_DIR, normalized);
    if (!target.startsWith(PLUGINS_DIR + path.sep)) return null;
    return target;
};

const findSimilar = (input) => {
    const normalized = normalizeInput(input);
    const baseName = path.basename(normalized);
    const allFiles = listFiles(PLUGINS_DIR);
    return allFiles.filter(f => path.basename(f) === baseName);
};

export default {
    command: ['df', 'rm', 'deletefile'],
    category: 'owner',
    execute: async (denn, m, { args, prefix, isOwner }) => {
        if (!isOwner) {
            return sendFakeQuoted(denn, m, '❌ Command ini khusus Owner.');
        }

        const sub = (args[0] || '').toLowerCase();

        if (!sub || sub === 'help') {
            return sendFakeQuoted(denn, m,
                `🗑️ *DELETE FILE*\n\n` +
                `*Format:*\n` +
                `\`${prefix}df <path>\`\n` +
                `\`${prefix}rm <path>\`\n\n` +
                `*Contoh:*\n` +
                `\`${prefix}df tools/amprem\`\n` +
                `\`${prefix}rm downloader/capcut.js\`\n\n` +
                `*Lihat daftar:*\n` +
                `\`${prefix}df list\`\n` +
                `\`${prefix}df list tools\``,
                { title: 'Delete File', body: 'Owner only' }
            );
        }

        if (sub === 'list' || sub === 'ls') {
            const folder = args[1] || '';
            const targetDir = folder ? path.resolve(PLUGINS_DIR, folder) : PLUGINS_DIR;

            if (!targetDir.startsWith(PLUGINS_DIR)) {
                return sendFakeQuoted(denn, m, '❌ Path tidak valid.');
            }

            const files = listFiles(targetDir, folder);

            if (files.length === 0) {
                return sendFakeQuoted(denn, m, `📂 Folder *${folder || 'plugins'}* kosong atau tidak ada file .js.`);
            }

            const maxShow = 80;
            const shown = files.slice(0, maxShow);
            let text = `📂 *DAFTAR FILE${folder ? ` (${folder})` : ''}*\n\n`;
            text += shown.map((f, i) => `${i + 1}. \`${f}\``).join('\n');
            if (files.length > maxShow) {
                text += `\n\n_...dan ${files.length - maxShow} file lainnya._`;
            }
            text += `\n\n_Total: ${files.length} file_`;

            return sendFakeQuoted(denn, m, text, { title: 'List File', body: `${files.length} file` });
        }

        const targetPath = resolvePluginPath(sub);

        if (!targetPath) {
            return sendFakeQuoted(denn, m, '❌ Path tidak valid. Tidak boleh keluar dari folder plugins.');
        }

        if (!fs.existsSync(targetPath)) {
            const similar = findSimilar(sub);
            let suggestion = '';
            if (similar.length > 0) {
                suggestion = `\n\n💡 *Mungkin maksudmu:*\n` + similar.slice(0, 5).map(f => `• \`${f}\``).join('\n');
            } else {
                const parts = sub.split('/');
                if (parts.length > 1) {
                    const folder = parts.slice(0, -1).join('/');
                    const filesInFolder = listFiles(path.resolve(PLUGINS_DIR, folder), folder);
                    if (filesInFolder.length > 0 && filesInFolder.length <= 20) {
                        suggestion = `\n\n📂 *Isi folder ${folder}:*\n` + filesInFolder.map(f => `• \`${path.basename(f, '.js')}\``).join('\n');
                    }
                }
            }
            return sendFakeQuoted(denn, m, `❌ File tidak ditemukan:\n\`${sub}\`${suggestion}`);
        }

        const stat = fs.statSync(targetPath);
        if (!stat.isFile()) {
            return sendFakeQuoted(denn, m, '❌ Path bukan file.');
        }

        try {
            fs.unlinkSync(targetPath);

            let reloadText = '';
            if (typeof global.reloadPlugins === 'function') {
                try {
                    const total = await global.reloadPlugins();
                    reloadText = `\n🔄 Plugin di-reload. Total aktif: *${total}*`;
                } catch (_) {
                    reloadText = `\n⚠️ File dihapus, tapi reload gagal. Ketik \`${prefix}reload\` manual.`;
                }
            }

            await sendFakeQuoted(denn, m,
                `✅ *FILE DIHAPUS*\n\n` +
                `📄 \`${sub}\`\n` +
                `📦 Ukuran: ${(stat.size / 1024).toFixed(1)} KB${reloadText}`,
                { title: 'Delete File', body: 'Berhasil' }
            );
        } catch (err) {
            await sendFakeQuoted(denn, m, `❌ Gagal hapus file:\n${err.message}`);
        }
    }
};