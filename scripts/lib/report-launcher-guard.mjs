// PT-0353: imported FIRST by `report-planificare.ts`. ES modules evaluate their imports before the
// importing file's body, so a check in the entry's body would run only after `@/lib/env` and the
// database client had loaded with whatever the shell held. Here it runs before either.
if (process.env.P4T_REPORT_LAUNCHER !== "1") {
  console.error(
    "report:planificare: run it as `pnpm report:planificare`, not this file directly",
  );
  process.exit(2);
}
