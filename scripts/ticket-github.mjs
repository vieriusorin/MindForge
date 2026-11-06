#!/usr/bin/env node
/**
 * MF-0055: `pnpm ticket:github` mirrors `.planning/tasks/<ID>/GOAL.md` onto its GitHub issue and the
 * MindForge project (`.planning/github.json`): creates the issue for a new ticket, sets the status
 * label, project Status + Stage, milestone, assignee, parent (sub-issue) and "blocked by" links, and
 * comments on the issue when the stage or status moves. Decisions live in `scripts/lib/ticket-github.mjs`.
 *
 *   pnpm ticket:github <ID>            sync one ticket (creates its issue if missing)
 *   pnpm ticket:github <ID> --claim    assign yourself, set goal_status in-progress, sync
 *   pnpm ticket:github next            print the next free ticket id (issues + every branch)
 *   pnpm ticket:github --changed       sync GOALs whose content changed since the last sync here
 *   pnpm ticket:github --all           sync every ticket (slow; repairs drift)
 *   add --dry-run to print without writing; --background (with --changed) detaches, for the Stop hook
 *
 * Needs the GitHub CLI logged in with the `project` scope (`gh auth refresh -s project`). Under
 * --changed a missing or logged-out `gh` is a logged skip, never a failure: it runs from a hook.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  claimDecision,
  issueBody,
  issueTitle,
  milestoneFor,
  nextTicketId,
  parseGoal,
  progressComment,
  STATUS_LABELS,
  syncPlan,
} from "./lib/ticket-github.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TASKS = join(ROOT, ".planning", "tasks");
const CACHE = join(ROOT, ".planning", ".github-sync.json");
const LOG = join(ROOT, ".planning", ".github-sync.log");
const CONFIG = JSON.parse(
  readFileSync(join(ROOT, ".planning", "github.json"), "utf8"),
);
const REPO = CONFIG.repo;
const BLOB = `https://github.com/${REPO}/blob/main`;

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const DRY = flag("--dry-run");
const positional = args.filter((a) => !a.startsWith("--"));

// ---------- gh plumbing

function gh(ghArgs, { allowFail = false } = {}) {
  const run = spawnSync("gh", ghArgs, { encoding: "utf8", cwd: ROOT });
  if (run.error || run.status !== 0) {
    if (allowFail) return null;
    const why = run.error?.message ?? (run.stderr || run.stdout).trim();
    throw new Error(`gh ${ghArgs.slice(0, 3).join(" ")}: ${why}`);
  }
  return run.stdout.trim();
}
const ghJson = (a) => JSON.parse(gh(a) || "null");

function write(desc, ghArgs, opts) {
  if (DRY) {
    console.log(`  [dry-run] ${desc}`);
    return null;
  }
  return gh(ghArgs, opts);
}

function ghReady() {
  return spawnSync("gh", ["auth", "status"], { encoding: "utf8" }).status === 0;
}

// ---------- cached lookups (one run)

let issueIndex;
function issuesById() {
  if (!issueIndex) {
    issueIndex = new Map();
    const list = ghJson([
      "issue",
      "list",
      "--repo",
      REPO,
      "--state",
      "all",
      "--limit",
      "1000",
      "--json",
      "number,title",
    ]);
    for (const { number, title } of list) {
      const id = title.match(/^(MF-\d{4}):/)?.[1];
      if (id && !issueIndex.has(id)) issueIndex.set(id, number);
    }
  }
  return issueIndex;
}

let projectInfo;
function project() {
  if (!projectInfo) {
    const owner = CONFIG.projectOwner;
    const number = String(CONFIG.projectNumber);
    const id = gh([
      "project",
      "view",
      number,
      "--owner",
      owner,
      "--format",
      "json",
      "--jq",
      ".id",
    ]);
    const fields = ghJson([
      "project",
      "field-list",
      number,
      "--owner",
      owner,
      "--format",
      "json",
    ]).fields;
    const select = (name) => {
      const f = fields.find((x) => x.name === name);
      return f
        ? {
            id: f.id,
            options: new Map((f.options ?? []).map((o) => [o.name, o.id])),
          }
        : null;
    };
    projectInfo = {
      owner,
      number,
      id,
      status: select("Status"),
      stage: select("Stage"),
    };
  }
  return projectInfo;
}

let me;
const whoAmI = () => (me ??= gh(["api", "user", "--jq", ".login"]));

let labelsReady = false;
function ensureLabels() {
  if (labelsReady || DRY) return;
  const colors = {
    "status: backlog": "ededed",
    "status: in progress": "fbca04",
    "status: blocked": "d93f0b",
    "status: in review": "0e8a16",
    "tier: normal": "c5def5",
    "tier: high-risk": "b60205",
  };
  for (const [name, color] of Object.entries(colors))
    gh(["label", "create", name, "--repo", REPO, "--color", color, "--force"], {
      allowFail: true,
    });
  labelsReady = true;
}

// ---------- cache (per machine, gitignored)

const readCache = () =>
  existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : null;
const saveCache = (c) =>
  !DRY && writeFileSync(CACHE, `${JSON.stringify(c, null, 1)}\n`);
const hash = (s) =>
  createHash("sha256")
    .update(s.replace(/\r\n/g, "\n"))
    .digest("hex")
    .slice(0, 16);
const goalPath = (id) => join(TASKS, id, "GOAL.md");
const allIds = () =>
  readdirSync(TASKS)
    .filter((d) => /^MF-\d{4}$/.test(d) && existsSync(goalPath(d)))
    .sort();

// ---------- one ticket

function syncTicket(id, cache) {
  const text = readFileSync(goalPath(id), "utf8");
  const goal = parseGoal(text);
  if (goal.id !== id)
    throw new Error(`${id}: GOAL.md ticket_id is "${goal.id}"`);
  ensureLabels();

  let number = cache[id]?.issue ?? issuesById().get(id);
  if (!number) {
    const title = issueTitle(goal, null);
    console.log(`${id}: creating issue "${title}"`);
    const url = write(`create issue ${title}`, [
      "issue",
      "create",
      "--repo",
      REPO,
      "--title",
      title,
      "--body",
      issueBody(goal, BLOB),
      "--label",
      `tier: ${goal.tier}`,
    ]);
    if (!url) return;
    number = Number(url.split("/").pop());
    issuesById().set(id, number);
  }

  const issue = ghJson([
    "issue",
    "view",
    String(number),
    "--repo",
    REPO,
    "--json",
    "state,title,assignees,labels,milestone,url",
  ]);
  const assignees = issue.assignees.map((a) => a.login);
  const plan = syncPlan(goal, {
    isClosed: issue.state === "CLOSED",
    assignees,
  });
  const ref = `#${number}`;

  if (goal.title && issue.title !== issueTitle(goal, issue.title))
    write(`${ref} title`, [
      "issue",
      "edit",
      String(number),
      "--repo",
      REPO,
      "--title",
      issueTitle(goal, issue.title),
    ]);

  const labels = issue.labels.map((l) => l.name);
  // No label decided (unknown or stale status) leaves the labels alone; a closed issue sheds them all.
  const relabel = plan.label !== null || issue.state === "CLOSED";
  const stale = Object.values(STATUS_LABELS).filter(
    (l) => relabel && l !== plan.label && labels.includes(l),
  );
  const editArgs = [];
  if (plan.label && !labels.includes(plan.label))
    editArgs.push("--add-label", plan.label);
  if (!labels.includes(`tier: ${goal.tier}`))
    editArgs.push("--add-label", `tier: ${goal.tier}`);
  for (const l of stale) editArgs.push("--remove-label", l);
  if (plan.assignMe) editArgs.push("--add-assignee", whoAmI());
  const milestone = milestoneFor(goal.week);
  if (milestone && issue.milestone?.title !== milestone)
    editArgs.push("--milestone", milestone);
  if (editArgs.length)
    write(`${ref} ${editArgs.join(" ")}`, [
      "issue",
      "edit",
      String(number),
      "--repo",
      REPO,
      ...editArgs,
    ]);

  if (plan.close)
    write(`${ref} close (${plan.close})`, [
      "issue",
      "close",
      String(number),
      "--repo",
      REPO,
      "--reason",
      plan.close,
    ]);

  const comment = progressComment(cache[id], goal);
  if (comment && issue.state !== "CLOSED")
    write(`${ref} comment`, [
      "issue",
      "comment",
      String(number),
      "--repo",
      REPO,
      "--body",
      comment,
    ]);

  // project item: add is idempotent and returns the item id
  const p = project();
  const itemId = write(`${ref} add to project`, [
    "project",
    "item-add",
    p.number,
    "--owner",
    p.owner,
    "--url",
    issue.url,
    "--format",
    "json",
    "--jq",
    ".id",
  ]);
  for (const [fieldInfo, value] of [
    [p.status, plan.projectStatus],
    [p.stage, plan.stage],
  ]) {
    const option = value && fieldInfo?.options.get(value);
    if (!itemId || !option) continue;
    gh([
      "project",
      "item-edit",
      "--project-id",
      p.id,
      "--id",
      itemId,
      "--field-id",
      fieldInfo.id,
      "--single-select-option-id",
      option,
    ]);
  }

  // relationships: only to tickets that already have an issue; repeats and cycles fail harmlessly
  const dbId = (n) => gh(["api", `repos/${REPO}/issues/${n}`, "--jq", ".id"]);
  if (goal.parent && issuesById().get(goal.parent)) {
    const parentNo = issuesById().get(goal.parent);
    const current = gh(
      ["api", `repos/${REPO}/issues/${number}/parent`, "--jq", ".number"],
      { allowFail: true },
    );
    if (String(current) !== String(parentNo))
      write(
        `${ref} sub-issue of ${goal.parent}`,
        [
          "api",
          "-X",
          "POST",
          `repos/${REPO}/issues/${parentNo}/sub_issues`,
          "-F",
          `sub_issue_id=${dbId(number)}`,
        ],
        { allowFail: true },
      );
  }
  const blockers = goal.dependsOn
    .map((d) => issuesById().get(d))
    .filter(Boolean);
  if (blockers.length) {
    const have = new Set(
      ghJson([
        "api",
        `repos/${REPO}/issues/${number}/dependencies/blocked_by`,
        "--jq",
        "[.[].number]",
      ]) ?? [],
    );
    for (const b of blockers.filter((n) => !have.has(n)))
      write(
        `${ref} blocked by #${b}`,
        [
          "api",
          "-X",
          "POST",
          `repos/${REPO}/issues/${number}/dependencies/blocked_by`,
          "-F",
          `issue_id=${dbId(b)}`,
        ],
        { allowFail: true },
      );
  }

  console.log(
    `${id} ${ref}: ${plan.projectStatus ?? "status unchanged"} · ${plan.stage ?? "no stage"}${milestone ? ` · ${milestone}` : ""}`,
  );
  cache[id] = {
    issue: number,
    hash: hash(text),
    stage: goal.stage,
    status: goal.status,
  };
}

// ---------- commands

function cmdNext() {
  const branches = spawnSync(
    "git",
    ["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes"],
    { encoding: "utf8", cwd: ROOT },
  )
    .stdout.split("\n")
    .filter(Boolean);
  const onBranches = branches.flatMap((ref) =>
    spawnSync("git", ["ls-tree", "--name-only", `${ref}:.planning/tasks`], {
      encoding: "utf8",
      cwd: ROOT,
    }).stdout.split("\n"),
  );
  // A bare folder counts: Stage 0 claims a number with `mkdir` before GOAL.md exists.
  const taken = [
    ...readdirSync(TASKS),
    ...onBranches,
    ...(ghReady() ? issuesById().keys() : []),
  ];
  console.log(nextTicketId(taken));
}

function cmdClaim(id, cache) {
  const issueNo = issuesById().get(id);
  if (issueNo) {
    const assignees = ghJson([
      "issue",
      "view",
      String(issueNo),
      "--repo",
      REPO,
      "--json",
      "assignees",
      "--jq",
      "[.assignees[].login]",
    ]);
    const decision = claimDecision(assignees, whoAmI(), flag("--force"));
    if (!decision.ok) {
      console.error(`${id}: not claimed: ${decision.reason}`);
      process.exit(1);
    }
  }
  const path = goalPath(id);
  const text = readFileSync(path, "utf8");
  const claimed = text.replace(
    /^goal_status:[ \t]*reserved\b/m,
    "goal_status: in-progress",
  );
  if (claimed !== text && !DRY) writeFileSync(path, claimed);
  syncTicket(id, cache);
  const n = issuesById().get(id);
  if (n)
    write(`#${n} assign ${whoAmI()}`, [
      "issue",
      "edit",
      String(n),
      "--repo",
      REPO,
      "--add-assignee",
      whoAmI(),
    ]);
  console.log(`${id}: claimed by ${whoAmI()}`);
}

function main() {
  if (flag("--background")) {
    const out = openSync(LOG, "a");
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(import.meta.url),
        ...args.filter((a) => a !== "--background"),
      ],
      {
        cwd: ROOT,
        detached: true,
        stdio: ["ignore", out, out],
      },
    );
    child.unref();
    return;
  }

  if (positional[0] === "next") return cmdNext();

  const fromHook = flag("--changed");
  if (!ghReady()) {
    const msg =
      "ticket:github: gh is missing or not logged in (brew install gh; gh auth login; gh auth refresh -s project)";
    if (fromHook)
      return console.log(`${new Date().toISOString()} ${msg}; skipped`);
    console.error(msg);
    process.exit(1);
  }

  const prior = readCache();
  const cache = prior ?? {};
  let ids;
  if (flag("--all")) ids = allIds();
  else if (fromHook) {
    if (!prior) {
      // First run on this machine: record today's GOALs as the baseline instead of re-syncing all.
      for (const id of allIds()) {
        const t = readFileSync(goalPath(id), "utf8");
        const g = parseGoal(t);
        cache[id] = { hash: hash(t), stage: g.stage, status: g.status };
      }
      saveCache(cache);
      console.log(
        `${new Date().toISOString()} ticket:github: baseline recorded for ${allIds().length} tickets`,
      );
      return;
    }
    ids = allIds().filter(
      (id) => cache[id]?.hash !== hash(readFileSync(goalPath(id), "utf8")),
    );
    if (ids.length)
      console.log(
        `${new Date().toISOString()} ticket:github --changed: ${ids.join(", ")}`,
      );
  } else if (/^MF-\d{4}$/.test(positional[0] ?? "")) ids = [positional[0]];
  else {
    console.error(
      "usage: pnpm ticket:github <MF-####> [--claim] [--force] | next | --changed | --all  [--dry-run]",
    );
    process.exit(2);
  }

  if (flag("--claim")) {
    cmdClaim(ids[0], cache);
    saveCache(cache);
    return;
  }

  let failed = 0;
  for (const id of ids) {
    try {
      syncTicket(id, cache);
    } catch (error) {
      failed += 1;
      console.error(
        `${id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  saveCache(cache);
  if (failed && !fromHook) process.exit(1);
}

main();
