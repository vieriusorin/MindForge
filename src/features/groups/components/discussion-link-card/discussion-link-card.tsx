import { ExternalLink, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DiscussionLinkCardProps } from "./types";

/**
 * MF-0063: where the group talks about its current course: an external chat the admin links.
 * Shows the course and the link's host only; no figure about any member.
 */
export function DiscussionLinkCard({
  link,
  courseName,
  form,
}: DiscussionLinkCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessagesSquare aria-hidden className="size-4" />
          Discussion
        </CardTitle>
        <CardDescription>Current course: {courseName}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {link ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Button asChild>
              <a href={link.href} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden />
                Discuss this course
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Button>
            <span className="text-sm text-muted-foreground">
              on {link.host}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No discussion link yet.
          </p>
        )}
        {form}
      </CardContent>
    </Card>
  );
}
