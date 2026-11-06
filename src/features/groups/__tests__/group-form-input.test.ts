import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  AdvanceGroupCourseInput,
  CreateGroupInput,
  CreatePathGroupInput,
  GroupFormInput,
  JoinGroupInput,
} from "../schemas";

const GROUP_ID = "4f1c2a3b-5d6e-4f70-8a9b-0c1d2e3f4a5b";

function fieldMessages(
  result: z.ZodSafeParseResult<unknown>,
  field: string,
): string[] {
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => issue.path[0] === field)
    .map((issue) => issue.message);
}

describe("GroupFormInput", () => {
  it("keeps packSlug for the pack kind and drops a leftover pathSlug", () => {
    const parsed = GroupFormInput.parse({
      kind: "pack",
      name: "Study crew",
      packSlug: "claude-developer-foundations",
      pathSlug: "claude-developer",
    });
    expect(parsed).toEqual({
      kind: "pack",
      name: "Study crew",
      packSlug: "claude-developer-foundations",
    });
  });

  it("keeps pathSlug for the path kind and drops a leftover packSlug", () => {
    const parsed = GroupFormInput.parse({
      kind: "path",
      name: "Study crew",
      packSlug: "claude-developer-foundations",
      pathSlug: "claude-developer",
    });
    expect(parsed).toEqual({
      kind: "path",
      name: "Study crew",
      pathSlug: "claude-developer",
    });
  });

  it("asks for a path when the path kind has none", () => {
    const result = GroupFormInput.safeParse({
      kind: "path",
      name: "Study crew",
      pathSlug: "",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldMessages(result, "pathSlug")).toEqual(["Pick a path."]);
  });

  it("asks for a learning pack when the pack kind has none", () => {
    const result = GroupFormInput.safeParse({
      kind: "pack",
      name: "Study crew",
      packSlug: "",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldMessages(result, "packSlug")).toEqual([
      "Pick a learning pack.",
    ]);
  });

  it("trims the name and still requires one", () => {
    expect(
      GroupFormInput.parse({
        kind: "path",
        name: "  Study crew  ",
        pathSlug: "claude-developer",
      }).name,
    ).toBe("Study crew");

    const result = GroupFormInput.safeParse({
      kind: "path",
      name: "   ",
      pathSlug: "claude-developer",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldMessages(result, "name")).toEqual(["Give the group a name."]);
  });

  it("produces output each action's strict schema accepts once kind is dropped", () => {
    const pack = GroupFormInput.parse({
      kind: "pack",
      name: " Pack crew ",
      packSlug: "claude-developer-foundations",
      pathSlug: "",
    });
    const path = GroupFormInput.parse({
      kind: "path",
      name: " Path crew ",
      packSlug: "",
      pathSlug: "claude-developer",
    });
    if (pack.kind !== "pack" || path.kind !== "path")
      throw new Error("kind changed");
    const { kind: _packKind, ...packInput } = pack;
    const { kind: _pathKind, ...pathInput } = path;

    expect(CreateGroupInput.parse(packInput)).toEqual({
      name: "Pack crew",
      packSlug: "claude-developer-foundations",
    });
    expect(CreatePathGroupInput.parse(pathInput)).toEqual({
      name: "Path crew",
      pathSlug: "claude-developer",
    });
  });
});

describe("CreatePathGroupInput", () => {
  it("rejects a key the action does not take", () => {
    expect(
      CreatePathGroupInput.safeParse({
        name: "Crew",
        pathSlug: "claude-developer",
        packSlug: "claude-developer-foundations",
      }).success,
    ).toBe(false);
  });

  it("asks for a path when the slug is malformed", () => {
    const result = CreatePathGroupInput.safeParse({
      name: "Crew",
      pathSlug: "Not A Slug",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldMessages(result, "pathSlug")).toEqual(["Pick a path."]);
  });
});

describe("CreateGroupInput", () => {
  it("keeps its MF-0002 messages", () => {
    const result = CreateGroupInput.safeParse({ name: "", packSlug: "" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldMessages(result, "name")).toEqual(["Give the group a name."]);
    expect(fieldMessages(result, "packSlug")).toEqual([
      "Pick a learning pack.",
    ]);
    expect(
      fieldMessages(
        CreateGroupInput.safeParse({ name: "x".repeat(81), packSlug: "p" }),
        "name",
      ),
    ).toEqual(["Keep the name under 80 characters."]);
  });
});

describe("JoinGroupInput", () => {
  it("accepts a hex invite code", () => {
    expect(JoinGroupInput.parse({ code: "0123456789abcdef" })).toEqual({
      code: "0123456789abcdef",
    });
  });

  it("rejects a malformed code and extra keys", () => {
    expect(JoinGroupInput.safeParse({ code: "not-a-code" }).success).toBe(
      false,
    );
    expect(
      JoinGroupInput.safeParse({ code: "0123456789abcdef", groupId: "x" })
        .success,
    ).toBe(false);
  });
});

describe("AdvanceGroupCourseInput", () => {
  it("takes the group id and the pack the screen showed", () => {
    expect(
      AdvanceGroupCourseInput.parse({
        groupId: GROUP_ID,
        fromPack: "claude-developer-foundations",
      }),
    ).toEqual({ groupId: GROUP_ID, fromPack: "claude-developer-foundations" });
  });

  it("rejects a non-uuid group, a malformed pack and extra keys", () => {
    expect(
      AdvanceGroupCourseInput.safeParse({ groupId: "g-1", fromPack: "p" })
        .success,
    ).toBe(false);
    expect(
      AdvanceGroupCourseInput.safeParse({ groupId: GROUP_ID, fromPack: "P Q" })
        .success,
    ).toBe(false);
    expect(
      AdvanceGroupCourseInput.safeParse({
        groupId: GROUP_ID,
        fromPack: "p",
        toPack: "q",
      }).success,
    ).toBe(false);
  });
});
