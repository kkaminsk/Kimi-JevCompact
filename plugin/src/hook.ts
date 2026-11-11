// Placeholder bundle entry for the Kimi-JevCompact plugin.
// The real PreCompact hook lands with the `jev-hook-script` OpenSpec change;
// this placeholder only proves the toolchain: stdin in, one JSON line out.
import { SYSTEM_ONE_URL } from 'fast-jev-compaction';

let input = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) {
  input += chunk;
}
void input;

console.log(
  JSON.stringify({ message: `kimi-jevcompact scaffold placeholder (${SYSTEM_ONE_URL})` }),
);
