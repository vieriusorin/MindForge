import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResetLink } from "./components/reset-link";
import type { InviteLinkProps } from "./types";

export function InviteLink({
  inviteUrl,
  canRotate,
  rotateAction,
}: InviteLinkProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite colleagues</CardTitle>
        <CardDescription>
          Anyone with this link can join after signing in.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="invite-url" className="sr-only">
            Invite link
          </FieldLabel>
          <Input
            id="invite-url"
            readOnly
            value={inviteUrl}
            className="font-mono text-xs"
          />
        </Field>
        {canRotate && <ResetLink rotateAction={rotateAction} />}
      </CardContent>
    </Card>
  );
}
