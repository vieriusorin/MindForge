"use client";

import { Controller } from "react-hook-form";
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
  const { control, register, errors, onSubmit, isSubmitting } =
    useCreateGroupForm(packs[0]?.slug ?? "");
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
            <Controller
              control={control}
              name="packSlug"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="pack">Learning pack</FieldLabel>
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id="pack"
                      className="w-full"
                      aria-invalid={fieldState.invalid}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    >
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
                  <FieldError
                    errors={fieldState.error ? [fieldState.error] : undefined}
                  />
                </Field>
              )}
            />
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
