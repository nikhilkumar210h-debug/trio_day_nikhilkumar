import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const files = {
  adminHtml: await readFile('public/admin-activity.html', 'utf8'),
  adminJs: await readFile('public/admin-activity.js', 'utf8'),
  playerJs: await readFile('public/activity-player.js', 'utf8'),
  playerHtml: await readFile('public/activity-player.html', 'utf8'),
  worker: await readFile('workers/gamification.js', 'utf8'),
  css: await readFile('public/styles/admin-activity-polish.css', 'utf8')
};

const checks = [
  ['Admin page loads its responsive polish stylesheet', files.adminHtml.includes('styles/admin-activity-polish.css?v=1')],
  ['Admin activity listing uses authenticated Worker API', files.adminJs.includes("adminApi('/api/admin/activity', { action: 'list' })")],
  ['Admin task listing uses authenticated Worker API', files.adminJs.includes("adminApi('/api/admin/task', { action: 'list'")],
  ['Worker exposes admin list actions for both tables', (files.worker.match(/case 'list'/g) || []).length === 2],
  ['Privileged Supabase requests use Worker environment secrets', files.worker.includes('env.SUPABASE_SERVICE_ROLE_KEY') && files.worker.includes('SUPABASE_SERVICE_ROLE_KEY is missing')],
  ['Task order field maps to the actual task_number column', files.adminJs.includes("task_number: parseInt(formData.get('order_index'), 10) || 1")],
  ['New activity selector options refresh after activity changes', files.adminJs.includes("const picker = $('taskActivityPicker')")],
  ['Task filter updates when its select changes', files.adminJs.includes("filterActivity.addEventListener('change', loadTasks)")],
  ['Published tasks require response-verification rules', files.adminJs.includes('Add response-verification rules before publishing')],
  ['Worker rejects tasks missing verification rules', files.worker.includes('This task is missing response-verification rules')],
  ['Minimum task time is checked by the Worker', files.worker.includes('submittedTime < minimumSeconds')],
  ['Player rejects unsuccessful verification responses', files.playerJs.includes('!res.ok || result.ok === false')],
  ['Player displays only XP actually awarded by the Worker', files.playerJs.includes('result.awarded ?? result.xpAwarded ?? 0')],
  ['Task description is included in both task selects', files.worker.includes('TASK_SELECT_PUBLIC =') && files.worker.includes('TASK_SELECT_ADMIN =') && files.worker.includes('title_hi,description_en,instructions_en')],
  ['Cloudinary upload uses the signed URL returned by the Worker', files.adminJs.includes('fetch(uploadUrl')],
  ['Task filter, editor close, cancel and create buttons have handlers', [
    "$('taskModalClose').onclick = closeTaskModal",
    "$('cancelTask').onclick = closeTaskModal",
    "$('cancelActivity').onclick = resetActivityForm",
    "$('createTaskBtn').onclick",
    "taskForm.onsubmit = saveTask",
    "activityForm.onsubmit = saveActivity"
  ].every(part => files.adminJs.includes(part))],
  ['Edit and delete task buttons are wired', files.adminJs.includes("tasksList.querySelectorAll('.edit-task')") && files.adminJs.includes("tasksList.querySelectorAll('.delete-task')")],
  ['Upload click, drop and file-change actions are wired', files.adminJs.includes('uploadArea.ondrop') && files.adminJs.includes('fileInput.onchange') && files.adminJs.includes('uploadArea.onclick')],
  ['Admin controls have mobile and reduced-motion styles', files.css.includes('@media(max-width:700px)') && files.css.includes('prefers-reduced-motion:reduce')],
  ['Task player cache version is updated', files.playerHtml.includes('activity-player.js?v=20261019-taskfix1')]
];

let failed = false;
for (const [label, passed] of checks) {
  console.log((passed ? 'PASS' : 'FAIL') + ' — ' + label);
  if (!passed) failed = true;
}

const tempDir = await mkdtemp(join(tmpdir(), 'trio-admin-check-'));
try {
  for (const [label, source] of [
    ['public/admin-activity.js', files.adminJs],
    ['public/activity-player.js', files.playerJs],
    ['workers/gamification.js', files.worker]
  ]) {
    const tempFile = join(tempDir, label.replaceAll('/', '-') + '.mjs');
    await writeFile(tempFile, source);
    const result = spawnSync(process.execPath, ['--check', tempFile], { encoding: 'utf8' });
    const passed = result.status === 0;
    console.log((passed ? 'PASS' : 'FAIL') + ' — JavaScript syntax: ' + label);
    if (!passed) {
      failed = true;
      console.error(result.stderr || result.stdout);
    }
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

if (failed) process.exit(1);
console.log('Admin Activity validation passed.');
