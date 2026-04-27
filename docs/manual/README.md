# NRCS EAM user manual (generated)

The Word manual and PowerPoint quick reference are produced by a small Node script in the repo.

## Regenerate

From the repository root:

```bash
cd scripts/nrcs-user-manual-output
npm install
```

`npm install` is only needed the first time (or after dependency changes).

Then:

```bash
node generate.mjs
```

You can also run from the repo root:

```bash
node scripts/nrcs-user-manual-output/generate.mjs
```

## Output location

Generated files are written to **`docs/manual/outputs/`**:

- `NRCS_EAM_User_Manual.docx`
- `NRCS_EAM_Quick_Reference.pptx`

That folder is listed in `.gitignore` so binaries are not committed.

## Update manual content

Edit **`scripts/nrcs-user-manual-output/doc-manual-body.mjs`** (chapters, steps, appendices). Regenerate with `node generate.mjs` when done.

## Refresh the catalogue (Appendix B)

When `shared/inventoryCatalogueSeed.ts` changes and you want `manual-catalogue.json` to match before editing the appendix text:

```bash
cd scripts/nrcs-user-manual-output
node extract-catalogue.mjs
```

To rebuild the **68-item** live catalogue slice used by the manual (see `refresh-catalogue.mjs` for rules):

```bash
node refresh-catalogue.mjs
```

Then regenerate the DOCX.
