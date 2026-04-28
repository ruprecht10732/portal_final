## Dark Matter: Hidden Couplings

Found 20 file pairs that frequently co-change but have no import relationship:

| File A | File B | NPMI | Co-Changes | Lift |
|--------|--------|------|------------|------|
| src/app/routes/auth/forgot-password/forgot-password.component.ts | src/app/routes/auth/reset-password/reset-password.component.ts | 1.000 | 4 | 125.00 |
| src/app/routes/auth/forgot-password/forgot-password.component.ts | src/app/routes/auth/sign-up/sign-up.component.ts | 1.000 | 4 | 125.00 |
| src/app/routes/auth/reset-password/reset-password.component.ts | src/app/routes/auth/sign-up/sign-up.component.ts | 1.000 | 4 | 125.00 |
| src/app/core/guards/auth.guard.ts | src/app/core/guards/guest.guard.ts | 1.000 | 3 | 166.67 |
| src/app/core/guards/auth.guard.ts | src/app/core/services/token-storage.service.ts | 1.000 | 3 | 166.67 |
| src/app/core/guards/guest.guard.ts | src/app/core/services/token-storage.service.ts | 1.000 | 3 | 166.67 |
| src/assets/i18n/en/common.json | src/assets/i18n/nl/common.json | 1.000 | 17 | 29.41 |
| src/assets/i18n/en/navigation.json | src/assets/i18n/nl/navigation.json | 1.000 | 11 | 45.45 |
| src/app/routes/organization/product-flow-editor/flow-builder/flow-builder.component.html | src/app/routes/organization/product-flow-editor/flow-builder/step-editor/step-editor.component.html | 1.000 | 4 | 125.00 |
| src/app/routes/organization/product-flow-editor/flow-builder/flow-builder.component.html | src/app/routes/organization/product-flow-editor/flow-builder/step-editor/step-editor.component.ts | 1.000 | 4 | 125.00 |
| src/assets/i18n/en/auth.json | src/assets/i18n/nl/auth.json | 1.000 | 4 | 125.00 |
| src/assets/i18n/en/profile.json | src/assets/i18n/nl/profile.json | 1.000 | 6 | 83.33 |
| src/assets/i18n/en/organization.json | src/assets/i18n/nl/organization.json | 1.000 | 33 | 15.15 |
| src/app/routes/app-shell/authenticated-sidebar-panel.component.ts | src/assets/i18n/en/sidebar.json | 1.000 | 3 | 166.67 |
| src/app/routes/app-shell/authenticated-sidebar-panel.component.ts | src/assets/i18n/nl/sidebar.json | 1.000 | 3 | 166.67 |
| src/app/routes/organization/organization-invite-form/organization-invite-form.component.ts | src/app/routes/organization/organization-invites/organization-invites.component.html | 1.000 | 3 | 166.67 |
| src/assets/i18n/en/sidebar.json | src/assets/i18n/nl/sidebar.json | 1.000 | 3 | 166.67 |
| src/assets/i18n/en/tasks.json | src/assets/i18n/nl/tasks.json | 1.000 | 4 | 125.00 |
| src/app/routes/organization/organization-integrations-layout/organization-integrations-layout.component.ts | src/app/routes/organization/organization-settings-layout/organization-settings-layout.component.ts | 1.000 | 3 | 166.67 |
| src/app/routes/organization/organization-integrations-layout/organization-integrations-layout.component.ts | src/app/routes/organization/organization-settings/smtp/organization-smtp-settings.component.ts | 1.000 | 3 | 166.67 |

These pairs likely share an architectural concern invisible to static analysis.
Consider adding explicit documentation or extracting the shared concern.