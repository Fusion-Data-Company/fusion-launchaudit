/** Environment-only operator ledger. No sending, audit execution or automatic migration.
 * Read queue: node --experimental-strip-types scripts/hands-on-work.ts
 * Record an already performed step: ... scripts/hands-on-work.ts --record /absolute/command.json
 */
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { getSqlClient } from '../src/lib/db.ts';
import { handsOnQueue, updateHandsOnWork, type HandsOnCommand } from '../src/lib/hands-on-work.ts';
const sql = await getSqlClient();
if (!sql) throw new Error('Connected database runtime required');
const args = process.argv.slice(2);
if (!args.length) console.log(JSON.stringify(await handsOnQueue(sql),null,2));
else {
  if (args.length !== 2 || args[0] !== '--record' || !isAbsolute(args[1]) || /\/\.env(?:\.|$)/.test(args[1]))
    throw new Error('Use --record with an absolute non-secret command JSON path');
  const command = JSON.parse(await readFile(args[1],'utf8')) as HandsOnCommand;
  const result = await updateHandsOnWork(sql,command);
  console.log(JSON.stringify({order_id:result.order_id,owner:result.owner,version:result.version,state:result.state}));
}
