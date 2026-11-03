"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateGroupForm } from "./hooks/use-create-group-form";
import type { CreateGroupFormProps } from "./types";

export function CreateGroupForm({ packs }: CreateGroupFormProps) {
  const { state, formAction, isPending } = useCreateGroupForm();
  const error = state.status === "error" ? state.message : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Start a study group</CardTitle>
        <CardDescription>Invite colleagues once it exists.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="group-name">Group name</FieldLabel>
              <Input id="group-name" name="name" required maxLength={80} />
            </Field>
            <Field>
              <FieldLabel htmlFor="pack">Learning pack</FieldLabel>
              <Select name="packSlug" required defaultValue={packs[0]?.slug}>
                <SelectTrigger id="pack" className="w-full">
                  <SelectValue placeholder="Choose a pack" />
                </SelectTrigger>
                <SelectContent>
                  {packs.map((p) => (
                    <SelectItem key={p.slug} value={p.slug}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <FieldError errors={error ? [{ message: error }] : undefined} />
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create group"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
