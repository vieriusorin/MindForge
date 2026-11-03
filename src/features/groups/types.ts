export type CreateGroupState =
  | { status: "idle" }
  | { status: "error"; message: string };
