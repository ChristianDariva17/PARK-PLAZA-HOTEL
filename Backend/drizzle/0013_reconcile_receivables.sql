WITH candidates AS (
  SELECT s.property_id, s.id AS stay_id,
    COALESCE(SUM(CASE WHEN e.type = 'charge' THEN e.amount WHEN e.type = 'payment' THEN -e.amount WHEN e.type = 'reversal' AND original.type = 'payment' THEN e.amount ELSE -e.amount END), 0)::numeric(14,2) AS amount
  FROM stays s
  JOIN folios f ON f.stay_id = s.id AND f.property_id = s.property_id
  LEFT JOIN folio_entries e ON e.folio_id = f.id AND e.property_id = s.property_id
  LEFT JOIN folio_entries original ON original.id = e.reversal_of_entry_id
  WHERE s.status = 'checked_out' AND s.settlement = 'receivable'
  GROUP BY s.property_id, s.id
), reconciled AS (
  UPDATE receivables r SET outstanding_amount = c.amount,
    status = CASE WHEN c.amount = 0 THEN 'settled'::receivable_status ELSE 'open'::receivable_status END,
    settled_at = CASE WHEN c.amount = 0 THEN COALESCE(r.settled_at, now()) ELSE NULL END,
    updated_at = now()
  FROM candidates c
  WHERE r.stay_id = c.stay_id AND r.property_id = c.property_id AND c.amount >= 0
    AND (r.outstanding_amount IS DISTINCT FROM c.amount
      OR r.status IS DISTINCT FROM CASE WHEN c.amount = 0 THEN 'settled'::receivable_status ELSE 'open'::receivable_status END
      OR r.settled_at IS DISTINCT FROM CASE WHEN c.amount = 0 THEN COALESCE(r.settled_at, now()) ELSE NULL END)
)
INSERT INTO receivables (property_id, stay_id, reservation_id, primary_guest_id, folio_id, status, original_amount, outstanding_amount, reason, opened_at)
SELECT s.property_id, s.id, s.reservation_id, r.primary_guest_id, f.id, 'open', c.amount, c.amount, COALESCE(s.receivable_reason, 'Legacy receivable'), COALESCE(s.check_out_at, now())
FROM candidates c
JOIN stays s ON s.id = c.stay_id AND s.property_id = c.property_id
JOIN reservations r ON r.id = s.reservation_id AND r.property_id = s.property_id
JOIN folios f ON f.stay_id = s.id AND f.property_id = s.property_id
LEFT JOIN receivables existing ON existing.stay_id = c.stay_id
WHERE c.amount > 0 AND existing.id IS NULL;
