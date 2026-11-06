/**
 * MF-0059: what the join page read. `notice` is the path notice (`joinNotice`) for a group that
 * follows a path, null for a pack-only group; the page maps the path name, the client never reads it.
 */
export type JoinCardProps =
  | { status: "invalid" }
  | {
      status: "ready";
      code: string;
      groupName: string;
      notice: string | null;
    };

export type JoinReadyProps = Pick<
  Extract<JoinCardProps, { status: "ready" }>,
  "code" | "groupName" | "notice"
>;

export interface UseJoinCardReturn {
  join: () => void;
  /** True while joining and through the navigation after success, so nobody joins twice. */
  isPending: boolean;
  /** Why the join failed, or null. */
  errorMessage: string | null;
}
