// Minimal check recorder: the scenarios are one long stateful story, so each check is a line, not a test case.
const results = [];
let suite = '';

function startSuite(name) {
  suite = name;
  console.log(`\n=== ${name}`);
}

function section(title) {
  console.log(`\n--- ${title}`);
}

function check(name, cond, detail = '') {
  results.push({ suite, name, ok: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `  -- ${detail}`}`);
}

/** Prints per-suite counts and the failures; returns the number of failed checks. */
function summary() {
  const suites = [...new Set(results.map(r => r.suite))];
  console.log('');
  for (const s of suites) {
    const rs = results.filter(r => r.suite === s);
    console.log(`${s}: ${rs.filter(r => r.ok).length}/${rs.length} passed`);
  }
  const failed = results.filter(r => !r.ok);
  for (const f of failed) console.log(`FAILED  [${f.suite}] ${f.name}${f.detail ? `  -- ${f.detail}` : ''}`);
  console.log(`total: ${results.length - failed.length}/${results.length} passed`);
  return failed.length;
}

module.exports = { startSuite, section, check, summary };
