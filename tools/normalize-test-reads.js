// test/ の readFileSync に改行の正規化を挟む一回きりの道具（2026-08-16）。
//
// なぜ要ったか: 作業コピーは CRLF、gitの中身とCIは LF。テストが
// `indexOf('</div>\n        <!--')` のように**改行を含む文字列で位置を探す**と、
// ローカルでは見つからず(-1)、slice(0,-1) が「残り全部」になって検査が空振りする。
// ローカル green・CI red が起き、しかもローカルは「通った」と嘘をつく。
//
// 対策は単純: 読んだ直後に CRLF を LF へ揃える。どの環境でも同じ文字列を見る。
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const SUFFIX = String.raw`.replace(/\r\n/g, '\n')`;
let changed = 0;

for(const f of readdirSync('test').filter(x => x.endsWith('.test.js'))){
  const p = 'test/' + f;
  const src = readFileSync(p, 'utf8');
  // readFileSync(…, 'utf8') の直後（既に正規化済みは除く）
  const out = src.replace(/readFileSync\(([\s\S]*?),\s*'utf8'\)(?!\s*\.replace)/g,
    (m, args) => `readFileSync(${args}, 'utf8')${SUFFIX}`);
  if(out !== src){ writeFileSync(p, out); changed++; }
}
console.log(`${changed} ファイルを更新`);
