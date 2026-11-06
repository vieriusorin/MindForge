"use client";

import { Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
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
import { useStartExpeditionForm } from "./hooks/use-start-expedition-form";
import type { StartExpeditionFormProps } from "./types";

export function StartExpeditionForm({
  groupId,
  domains,
}: StartExpeditionFormProps) {
  const { control, register, errors, onSubmit, isSubmitting } =
    useStartExpeditionForm({
      groupId,
      defaultDomainCode: domains[0]?.code ?? "",
    });
  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Controller
          control={control}
          name="domainCode"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="expedition-domain">Domain</FieldLabel>
              <Select
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
              >
                <SelectTrigger
                  id="expedition-domain"
                  className="w-full"
                  aria-invalid={fieldState.invalid}
                  onBlur={field.onBlur}
                  ref={field.ref}
                >
                  <SelectValue placeholder="Choose a domain" />
                </SelectTrigger>
                <SelectContent>
                  {domains.map((d) => (
                    <SelectItem key={d.code} value={d.code}>
                      {d.name}
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
        <Field data-invalid={Boolean(errors.target)}>
          <FieldLabel htmlFor="expedition-target">Target</FieldLabel>
          <Input
            id="expedition-target"
            type="number"
            inputMode="numeric"
            className="tabular-nums"
            aria-invalid={Boolean(errors.target)}
            aria-describedby="expedition-target-hint"
            {...register("target")}
          />
          <p
            id="expedition-target-hint"
            className="text-sm text-muted-foreground"
          >
            Correct recalls the group makes together.
          </p>
          <FieldError errors={errors.target ? [errors.target] : undefined} />
        </Field>
        <FieldError
          errors={errors.root?.server ? [errors.root.server] : undefined}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Starting…" : "Start expedition"}
        </Button>
      </FieldGroup>
    </form>
  );
}
