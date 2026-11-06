import { JoinReady } from "./components/join-ready";
import type { JoinCardProps } from "./types";

export function JoinCard(props: JoinCardProps) {
  if (props.status === "invalid") {
    return (
      <p role="alert" className="text-destructive">
        This invite link is invalid or has been reset. Ask a group member for a
        new one.
      </p>
    );
  }
  return (
    <JoinReady
      code={props.code}
      groupName={props.groupName}
      notice={props.notice}
    />
  );
}
