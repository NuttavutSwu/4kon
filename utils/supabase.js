const { createClient } = require('@supabase/supabase-js');

/**
 * Shared Supabase client used by server-side routes.
 *
 * Required env:
 * - `SUPABASE_URL`
 * - `SUPABASE_KEY`
 *
 * @type {Object}
 */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports = supabase;
