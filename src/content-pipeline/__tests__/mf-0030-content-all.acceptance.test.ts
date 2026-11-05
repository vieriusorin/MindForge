/**
 * MF-0030 acceptance (frozen): `pnpm content:all` and `pnpm dev:setup --with-corpus`. Expected values
 * are literals from GOAL.md (SC-1..SC-7, user decisions C-1..C-4 of 2026-11-05). The I/O is a fake:
 * no CLI is spawned and no API is called.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { corpusFetches } from "../../../scripts/lib/dev-setup-corpus.mjs";
import {
  type ContentStep,
  parseContentAllArgs,
  planContentAll,
  runContentAll,
} from "../content-all";

const ROOT = process.cwd();
const DOMAINS = ["D1", "D2"] as const;

interface FakeOptions {
  domains?: readonly string[] | null;
  estimates?: Partial<Record<string, number>>;
  failAt?: string;
  capUsd?: number;
}

/** Key of a step in `estimates` / `failAt`: "diagrams", "cards", "questions:D1", "corpus". */
const keyOf = (step: ContentStep) =>
  step.domain === null ? step.kind : `${step.kind}:${step.domain}`;

function fakeIo({
  domains = DOMAINS,
  estimates = {},
  failAt,
  capUsd = 50,
}: FakeOptions = {}) {
  const ran: ContentStep[] = [];
  const estimated: ContentStep[] = [];
  const lines: string[] = [];
  return {
    ran,
    estimated,
    output: () => lines.join("\n"),
    io: {
      loadDomains: async () => domains,
      runStep: async (step: ContentStep) => {
        ran.push(step);
        return keyOf(step) !== failAt;
      },
      estimateStep: async (step: ContentStep) => {
        estimated.push(step);
        return estimates[keyOf(step)] ?? 0;
      },
      capUsd,
      log: (line: string) => {
        lines.push(line);
      },
    },
  };
}

const flagValue = (argv: readonly string[], flag: string) =>
  argv[argv.indexOf(flag) + 1];

describe("MF-0030 SC-1: one pack, fixed order, questions per domain", () => {
  it("SC-1: corpus → diagrams → cards → questions once per domain, each with --pack", () => {
    const steps = planContentAll({
      pack: "a",
      domains: DOMAINS,
      run: false,
      corpus: true,
    });
    expect(steps.map(keyOf)).toEqual([
      "corpus",
      "diagrams",
      "cards",
      "questions:D1",
      "questions:D2",
    ]);
    for (const step of steps) {
      expect(flagValue(step.argv, "--pack")).toBe("a");
      if (step.kind === "questions")
        expect(flagValue(step.argv, "--domain")).toBe(step.domain);
    }
  });

  it("SC-1: no step runs prompts:lock or generate:eval", () => {
    for (const run of [false, true]) {
      const text = planContentAll({
        pack: "a",
        domains: DOMAINS,
        run,
        corpus: true,
      })
        .map((s) => s.argv.join(" "))
        .join("\n");
      expect(text).not.toMatch(/lock-prompts|prompts:lock|eval/);
    }
  });

  it("SC-1: --pack is required and must be a slug", () => {
    expect(() => parseContentAllArgs([])).toThrow(/--pack/);
    expect(() => parseContentAllArgs(["--pack", "Not A Slug"])).toThrow(
      /--pack/,
    );
    expect(parseContentAllArgs(["--pack", "ccdv-f"]).pack).toBe("ccdv-f");
  });

  it("SC-1: a pack without pack.yaml exits 1 before any step", async () => {
    const fake = fakeIo({ domains: null });
    expect(await runContentAll(["--pack", "nope"], fake.io)).toBe(1);
    expect(fake.ran).toEqual([]);
    expect(fake.estimated).toEqual([]);
  });

  it("SC-1: a missing --pack exits 1 before any step", async () => {
    const fake = fakeIo();
    expect(await runContentAll([], fake.io)).toBe(1);
    expect(fake.ran).toEqual([]);
    expect(fake.estimated).toEqual([]);
  });
});

describe("MF-0030 SC-2: dry by default", () => {
  it("SC-2: without --run every generation step carries --dry-run; corpus does not", () => {
    const steps = planContentAll({
      pack: "a",
      domains: DOMAINS,
      run: false,
      corpus: true,
    });
    for (const step of steps)
      expect(step.argv.includes("--dry-run"), keyOf(step)).toBe(
        step.kind !== "corpus",
      );
  });

  it("SC-2: with --run no step carries --dry-run", () => {
    const steps = planContentAll({
      pack: "a",
      domains: DOMAINS,
      run: true,
      corpus: true,
    });
    for (const step of steps)
      expect(step.argv.includes("--dry-run"), keyOf(step)).toBe(false);
  });

  it("SC-2: --no-corpus drops the corpus step; default keeps it", () => {
    expect(parseContentAllArgs(["--pack", "a"]).corpus).toBe(true);
    expect(parseContentAllArgs(["--pack", "a", "--no-corpus"]).corpus).toBe(
      false,
    );
    expect(parseContentAllArgs(["--pack", "a"]).run).toBe(false);
    const kinds = planContentAll({
      pack: "a",
      domains: DOMAINS,
      run: false,
      corpus: false,
    }).map((s) => s.kind);
    expect(kinds).not.toContain("corpus");
  });

  it("SC-2: the dry run fetches the corpus, estimates every batch, prints the total, spends nothing", async () => {
    const fake = fakeIo({
      estimates: {
        diagrams: 1.5,
        cards: 2.25,
        "questions:D1": 3,
        "questions:D2": 4,
      },
    });
    expect(await runContentAll(["--pack", "a"], fake.io)).toBe(0);
    expect(fake.ran.map(keyOf)).toEqual(["corpus"]);
    expect(fake.estimated.map(keyOf)).toEqual([
      "diagrams",
      "cards",
      "questions:D1",
      "questions:D2",
    ]);
    expect(fake.output()).toContain("10.75");
    expect(fake.output()).toMatch(/verifier/i);
  });
});

describe("MF-0030 SC-3: every writer batch under MF_MAX_BATCH_USD before spending", () => {
  const RUN = ["--pack", "a", "--run", "--max-total-usd", "1000"];

  it("SC-3: a batch at exactly the cap (50.00) runs every step in order, none dry", async () => {
    const fake = fakeIo({
      capUsd: 50,
      estimates: {
        diagrams: 50,
        cards: 50,
        "questions:D1": 50,
        "questions:D2": 50,
      },
    });
    expect(await runContentAll(RUN, fake.io)).toBe(0);
    expect(fake.ran.map(keyOf)).toEqual([
      "corpus",
      "diagrams",
      "cards",
      "questions:D1",
      "questions:D2",
    ]);
    for (const step of fake.ran)
      expect(step.argv.includes("--dry-run")).toBe(false);
  });

  it("SC-3: one batch at 50.01 refuses the whole run after the corpus and names it", async () => {
    const fake = fakeIo({
      capUsd: 50,
      estimates: { diagrams: 1, cards: 1, "questions:D2": 50.01 },
    });
    expect(await runContentAll(RUN, fake.io)).toBe(1);
    expect(fake.ran.map(keyOf)).toEqual(["corpus"]);
    expect(fake.output()).toMatch(/questions/);
    expect(fake.output()).toMatch(/D2/);
  });
});

describe("MF-0030 SC-4: --run needs --max-total-usd", () => {
  it.each([
    [["--pack", "a", "--run"]],
    [["--pack", "a", "--run", "--max-total-usd", "0"]],
    [["--pack", "a", "--run", "--max-total-usd", "-5"]],
    [["--pack", "a", "--run", "--max-total-usd", "abc"]],
  ])("SC-4: %j exits 1 before any step", async (argv) => {
    const fake = fakeIo();
    expect(await runContentAll(argv, fake.io)).toBe(1);
    expect(fake.ran).toEqual([]);
    expect(fake.estimated).toEqual([]);
  });

  it("SC-4: a total of exactly 100.00 runs; the verifier is stated as not counted", async () => {
    const fake = fakeIo({
      estimates: {
        diagrams: 25,
        cards: 25,
        "questions:D1": 25,
        "questions:D2": 25,
      },
    });
    expect(
      await runContentAll(
        ["--pack", "a", "--run", "--max-total-usd", "100"],
        fake.io,
      ),
    ).toBe(0);
    expect(fake.ran).toHaveLength(5);
    expect(fake.output()).toMatch(/verifier/i);
  });

  it("SC-4: a total of 100.01 refuses after the corpus, before any paid step", async () => {
    const fake = fakeIo({
      estimates: {
        diagrams: 25,
        cards: 25,
        "questions:D1": 25,
        "questions:D2": 25.01,
      },
    });
    expect(
      await runContentAll(
        ["--pack", "a", "--run", "--max-total-usd", "100"],
        fake.io,
      ),
    ).toBe(1);
    expect(fake.ran.map(keyOf)).toEqual(["corpus"]);
  });
});

describe("MF-0030 SC-5: dev:setup --with-corpus", () => {
  it("SC-5: without the flag no corpus fetch runs", () => {
    expect(corpusFetches([], ["a", "b"])).toEqual([]);
  });

  it("SC-5: with the flag every pack is fetched", () => {
    expect(corpusFetches(["--with-corpus"], ["a", "b"])).toEqual([
      ["scripts/generate/corpus.ts", "--pack", "a"],
      ["scripts/generate/corpus.ts", "--pack", "b"],
    ]);
  });

  it("SC-5: an unknown flag is refused", () => {
    expect(() => corpusFetches(["--with-corpse"], ["a"])).toThrow(
      /--with-corpse/,
    );
  });
});

describe("MF-0030 SC-6: a failing step stops the run", () => {
  it("SC-6: an offline corpus failure stops the dry run and names --no-corpus", async () => {
    const fake = fakeIo({ failAt: "corpus" });
    expect(await runContentAll(["--pack", "a"], fake.io)).not.toBe(0);
    expect(fake.estimated).toEqual([]);
    expect(fake.output()).toContain("--no-corpus");
  });

  it("SC-6: a failed diagrams step means cards and questions never start", async () => {
    const fake = fakeIo({ failAt: "diagrams" });
    expect(
      await runContentAll(
        ["--pack", "a", "--run", "--max-total-usd", "1000"],
        fake.io,
      ),
    ).not.toBe(0);
    expect(fake.ran.map(keyOf)).toEqual(["corpus", "diagrams"]);
  });
});

describe("MF-0030 SC-7: setup and CI never spend", () => {
  it("SC-7: content:all is not called from dev-setup or any workflow", () => {
    const workflows = join(ROOT, ".github", "workflows");
    const files = [
      join(ROOT, "scripts", "dev-setup.mjs"),
      ...readdirSync(workflows).map((n) => join(workflows, n)),
    ];
    for (const file of files)
      expect(readFileSync(file, "utf8"), file).not.toMatch(
        /content:all|content-all/,
      );
  });
});
