# Banco Falabella fixtures — provenance

**These fixtures are hand-authored from the selector contracts encoded in this bank's reading
routines. None of them was captured from a live Banco Falabella session.**

## Fixture-to-routine map

| Fixture | Routine | What it exercises |
| --- | --- | --- |
| `login.html` | `banco-falabella.login.script.ts` | Filling RUT/password after the normal-auth click, submit once. |
| `login-invalid-credentials.html` | `banco-falabella.login.script.ts` | Visible rejection banner produces `invalid_credentials` with no bank text. |
| `home.html` | `banco-falabella.home.script.ts` | One checking account and one credit card; two account movements, one billed card movement, and one pending (`billed: false`) card movement. |
