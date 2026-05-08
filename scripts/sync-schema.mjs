// One-shot helper: initialize Payload to trigger drizzle-kit push.
// Runs the same code path the dev server hits at boot, but as a script
// that exits cleanly. Bypasses the Payload CLI's CJS require()
// (which trips over top-level await in the ESM module graph).
//
// Run: NODE_ENV=development node --import=tsx scripts/sync-schema.mjs
import { getPayload } from 'payload'
import config from '../src/payload.config.ts'

const t0 = Date.now()
console.log('initializing payload (push will run if schema differs)...')

try {
  await getPayload({ config: typeof config === 'function' ? await config() : config })
  console.log(`✅ payload initialized in ${Date.now() - t0}ms — schema is in sync`)
  process.exit(0)
} catch (err) {
  console.error('❌ payload init failed:')
  console.error(err)
  process.exit(1)
}
