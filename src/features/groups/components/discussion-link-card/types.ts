import type { ReactNode } from "react";

export interface DiscussionLinkView {
  href: string;
  /** The host the link opens, shown next to it. */
  host: string;
}

export interface DiscussionLinkCardProps {
  /** From `discussionLinkView`; null when the group has no link. */
  link: DiscussionLinkView | null;
  /** The group's current course, named in the card's description. */
  courseName: string;
  /** The admin's form; absent for a member. */
  form?: ReactNode;
}
