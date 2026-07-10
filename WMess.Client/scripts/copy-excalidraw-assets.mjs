import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

// Excalidraw подгружает шрифты динамически по window.EXCALIDRAW_ASSET_PATH.
// Чтобы не зависеть от внешнего CDN (unpkg) — стенд работает по локальной сети, у клиента
// может не быть интернета — раскладываем шрифты пакета в раздаваемую папку public/ под
// изолированным префиксом excalidraw-assets/ (свой public/fonts проекта не трогаем).
// Папку не коммитим (.gitignore); скрипт запускается в dev/build перед стартом Vite.

// exports-карта пакета не отдаёт ./package.json, поэтому резолвим главный вход
// (.../dist/prod/index.js) и поднимаемся к корню пакета.
const require = createRequire(import.meta.url)
const entry = require.resolve('@excalidraw/excalidraw')
const pkgDir = path.resolve(path.dirname(entry), '..', '..')
const version = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version

const srcFonts = path.join(pkgDir, 'dist', 'prod', 'fonts')
const destRoot = path.resolve('./public/excalidraw-assets')
const destFonts = path.join(destRoot, 'fonts')
const marker = path.join(destRoot, '.version')

// Идемпотентность: если уже скопировано для текущей версии — выходим.
if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === version && fs.existsSync(destFonts)) {
  process.exit(0)
}

if (!fs.existsSync(srcFonts)) {
  console.warn(`[copy-excalidraw-assets] Пропуск: шрифты не найдены (${srcFonts})`)
  process.exit(0)
}

fs.rmSync(destRoot, { recursive: true, force: true })
fs.mkdirSync(destRoot, { recursive: true })
fs.cpSync(srcFonts, destFonts, { recursive: true })
fs.writeFileSync(marker, version)

console.log(`[copy-excalidraw-assets] Скопированы шрифты Excalidraw ${version} → public/excalidraw-assets/fonts`)
