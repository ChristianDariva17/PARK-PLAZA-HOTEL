# Receivables rollout

`/api/receivables` is the property-scoped, server-authoritative workspace for debts created at check-out. It is safe to disable the frontend `finanzas` route or module during rollback: no receivable collection deletes or edits the original folio entries.

The `0012_global_receivables` migration backfills only checked-out receivable stays with valid linked property records and a positive recomputed folio balance. Missing or mismatched legacy links are intentionally excluded for controlled reconciliation. Open legacy cash sessions without `opened_by_account_id` remain historical but cannot authorize receivable cash collections; close and reopen them under the responsible account.
