# Specification: Fix Public PDF Download Links

## Feature Description
Fix two related issues with PDF downloads on public pages (tracking page and quote proposal page) where download links either require authentication or fail silently after quote acceptance.

## User Scenarios

### Scenario 1: Lead downloads accepted quote PDF from tracking page
**Given** a lead has accepted a quote
**And** the lead visits their tracking page at `/track/:token`
**When** they click "Download PDF" for the accepted quote
**Then** the PDF should download immediately without requiring login

### Scenario 2: Lead downloads PDF after accepting quote on proposal page
**Given** a lead is viewing an accepted quote on the proposal page
**When** they click the "Download PDF" button
**Then** the PDF should download successfully
**And** if the download fails, a clear error message should be shown

## Functional Requirements

### FR-001: Public tracking page PDF download
The tracking page MUST allow downloading an accepted quote's PDF through a public (unauthenticated) mechanism.

### FR-002: No authenticated direct links on public pages
Public pages MUST NOT expose authenticated direct download URLs that redirect to login.

### FR-003: Error handling for PDF downloads
PDF download failures MUST show a clear error message to the user instead of failing silently.

### FR-004: Blob-based download on tracking page
The tracking page MUST use blob-based download (via public API) for quote PDFs, similar to the quote proposal page.

## Success Criteria

### SC-001: Tracking page download works without auth
A user on the tracking page can download an accepted quote PDF without being logged in.

### SC-002: No login redirects from public pages
Clicking "Download PDF" on public pages never redirects to the login page.

### SC-003: Clear error messages
When PDF download fails, the user sees a clear error message explaining the failure.

## Edge Cases
- Quote link (`d.quote.link`) might be missing or malformed
- Quote token extraction from link might fail
- Network errors during PDF download
- Backend returns 410 Gone or 404 Not Found for PDF
