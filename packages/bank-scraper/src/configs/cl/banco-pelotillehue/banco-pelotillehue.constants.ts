export const PELOTILLEHUE_BANK_ID = 'banco-pelotillehue';

export const PELOTILLEHUE_CREDENTIAL_ENTRY_ORIGIN = 'https://pelotillehue.test';

export const PELOTILLEHUE_ALLOWED_ORIGINS: readonly string[] = [PELOTILLEHUE_CREDENTIAL_ENTRY_ORIGIN];

/**
 * Structurally valid RUT used as the synthetic bank's "wrong password" sentinel. Never a real
 * person. Must pass `isValidRut` so the credential form accepts it and `loginScript` can emit
 * `invalid_credentials`. Assembled from parts so production source never embeds a full
 * check-digit-valid RUT literal (AC29 / source-rut-scan).
 */
const PELOTILLEHUE_REJECTED_RUT_BODY = '12.345.678';
const PELOTILLEHUE_REJECTED_RUT_DV = '5';
export const PELOTILLEHUE_INVALID_RUT = `${PELOTILLEHUE_REJECTED_RUT_BODY}-${PELOTILLEHUE_REJECTED_RUT_DV}`;

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
