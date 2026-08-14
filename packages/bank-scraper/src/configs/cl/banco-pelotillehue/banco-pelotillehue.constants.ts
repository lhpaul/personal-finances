export const PELOTILLEHUE_BANK_ID = 'banco-pelotillehue';

export const PELOTILLEHUE_CREDENTIAL_ENTRY_ORIGIN = 'https://pelotillehue.test';

export const PELOTILLEHUE_ALLOWED_ORIGINS: readonly string[] = [PELOTILLEHUE_CREDENTIAL_ENTRY_ORIGIN];

/** Check-digit-invalid RUT used as the synthetic bank's "wrong password" sentinel. Never a real person. */
export const PELOTILLEHUE_INVALID_RUT = '12.345.678-9';

export const PELOTILLEHUE_INLINE_HTML = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Banco Pelotillehue</title>
  </head>
  <body>
    <main>
      <h1>Banco Pelotillehue</h1>
      <p>Synthetic bank for scraper-lab. No remote navigation.</p>
    </main>
  </body>
</html>
`;
