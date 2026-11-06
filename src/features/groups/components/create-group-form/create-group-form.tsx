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
import { KindField } from "./components/kind-field";
import { PackField } from "./components/pack-field";
import { PathField } from "./components/path-field";
import { useCreateGroupForm } from "./hooks/use-create-group-form";
import type { CreateGroupFormProps } from "./types";

export function CreateGroupForm({ packs, paths }: CreateGroupFormProps) {
  const {
    control,
    register,
    errors,
    onSubmit,
    isSubmitting,
    kind,
    canChoosePath,
    pathNotice,
  } = useCreateGroupForm(packs[0]?.slug ?? "", paths);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Start a study group</CardTitle>
        <CardDescription>Invite colleagues once it exists.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="group-name">Group name</FieldLabel>
              <Input
                id="group-name"
                aria-invalid={Boolean(errors.name)}
                {...register("name")}
              />
              <FieldError errors={errors.name ? [errors.name] : undefined} />
            </Field>
            {canChoosePath ? <KindField control={control} /> : null}
            {kind === "path" ? (
              <PathField control={control} paths={paths} notice={pathNotice} />
            ) : (
              <PackField control={control} packs={packs} />
            )}
            <FieldError
              errors={errors.root?.server ? [errors.root.server] : undefined}
            />
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create group"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
