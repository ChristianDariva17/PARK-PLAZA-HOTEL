param(
  [string]$DatabaseName
)

$ErrorActionPreference = 'Stop'

$databaseUser = (docker compose exec -T postgres printenv POSTGRES_USER).Trim()
if ([string]::IsNullOrWhiteSpace($DatabaseName)) {
  $DatabaseName = (docker compose exec -T postgres printenv POSTGRES_DB).Trim()
}
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($databaseUser) -or [string]::IsNullOrWhiteSpace($DatabaseName)) {
  throw 'Could not read the PostgreSQL connection identity from the container.'
}
if ($DatabaseName -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
  throw 'DatabaseName must be a valid PostgreSQL identifier.'
}

$queries = @(
  "select 'database', current_database(); select 'postgres_version', current_setting('server_version');"
  "select 'supplier_archive_orphans', count(*) from suppliers s left join accounts a on a.id = s.archived_by_account_id where s.archived_by_account_id is not null and a.id is null;"
  "select 'supplier_archive_cross_property', count(*) from suppliers s join accounts a on a.id = s.archived_by_account_id where s.archived_by_account_id is not null and s.property_id <> a.property_id;"
  "select 'cross_property_events_space', count(*) from events e join event_spaces s on s.id = e.space_id where e.property_id <> s.property_id;"
  "select 'cross_property_events_guest', count(*) from events e join guests g on g.id = e.guest_id where e.property_id <> g.property_id;"
  "select 'cross_property_events_quarantine_resolver', count(*) from events e join accounts a on a.id = e.quarantine_resolved_by_account_id where e.quarantine_resolved_by_account_id is not null and e.property_id <> a.property_id;"
  "select 'cross_property_event_services', count(*) from event_services es join events e on e.id = es.event_id where es.property_id <> e.property_id;"
  "select 'cross_property_event_space_services', count(*) from event_space_services ess join event_spaces s on s.id = ess.space_id where ess.property_id <> s.property_id;"
  "select 'cross_property_event_recurrence', count(*) from event_recurrence er join events e on e.id = er.event_id where er.property_id <> e.property_id;"
  "select 'cross_property_event_exceptions', count(*) from event_occurrence_exceptions ex join events e on e.id = ex.event_id where ex.property_id <> e.property_id;"
  "select 'cross_property_event_exception_space', count(*) from event_occurrence_exceptions ex join events e on e.id = ex.event_id join event_spaces s on s.id = ex.override_space_id where ex.override_space_id is not null and e.property_id <> s.property_id;"
  "select 'cross_property_contract_reservations', count(*) from contracts c join reservations r on r.id = c.reservation_id where c.reservation_id is not null and c.property_id <> r.property_id;"
  "select 'cross_property_contract_versions_contracts', count(*) from contract_versions v join contracts c on c.id = v.contract_id where v.property_id <> c.property_id;"
  "select 'cross_property_contract_versions_creators', count(*) from contract_versions v join accounts a on a.id = v.creator_account_id where v.property_id <> a.property_id;"
  "select 'cross_property_evidences_creators', count(*) from evidences e join accounts a on a.id = e.creator_account_id where e.property_id <> a.property_id;"
  "select 'cross_property_contract_evidence_links_contracts', count(*) from contract_evidence_links l join contracts c on c.id = l.contract_id where l.property_id <> c.property_id;"
  "select 'cross_property_contract_evidence_links_evidences', count(*) from contract_evidence_links l join evidences e on e.id = l.evidence_id where l.property_id <> e.property_id;"
  "select 'cross_property_contract_evidence_links_accounts', count(*) from contract_evidence_links l join accounts a on a.id = l.linked_by_account_id where l.property_id <> a.property_id;"
  "select 'unknown_evidence_origins', count(*) from evidences where lower(origin_type) not in ('maintenance', 'cleaning', 'contracts', 'incidents');"
  "select 'orphan_evidence_origins', count(*) from evidences e where (lower(e.origin_type) = 'cleaning' and not exists (select 1 from cleaning_tasks t where t.id = e.origin_id and t.property_id = e.property_id)) or (lower(e.origin_type) = 'maintenance' and not exists (select 1 from incidents i where i.id = e.origin_id and i.property_id = e.property_id and i.type = 'maintenance')) or (lower(e.origin_type) = 'incidents' and not exists (select 1 from incidents i where i.id = e.origin_id and i.property_id = e.property_id)) or (lower(e.origin_type) = 'contracts' and not exists (select 1 from contracts c where c.id = e.origin_id and c.property_id = e.property_id));"
  "select 'cross_property_experiences_published_by', count(*) from experiences e join accounts a on a.id = e.published_by where e.published_by is not null and e.property_id <> a.property_id;"
  "select 'cross_property_experience_participations_experiences', count(*) from experience_participations p join experiences e on e.id = p.experience_id where p.property_id <> e.property_id;"
  "select 'cross_property_experience_participations_stays', count(*) from experience_participations p join stays s on s.id = p.stay_id where p.stay_id is not null and p.property_id <> s.property_id;"
  "select 'cross_property_experience_participations_guests', count(*) from experience_participations p join guests g on g.id = p.guest_id where p.guest_id is not null and p.property_id <> g.property_id;"
  "select 'cross_property_experience_participations_registrars', count(*) from experience_participations p join accounts a on a.id = p.registered_by where p.property_id <> a.property_id;"
  "select 'cross_property_amenity_reservations_stays', count(*) from amenity_reservations ar join stays s on s.id = ar.stay_id where ar.stay_id is not null and ar.property_id <> s.property_id;"
  "select 'cross_property_customer_amenity_commands_reservations', count(*) from customer_amenity_commands c join amenity_reservations ar on ar.id = c.amenity_reservation_id where c.property_id <> ar.property_id;"
  "select 'cross_property_orders_stays', count(*) from orders o join stays s on s.id = o.stay_id where o.stay_id is not null and o.property_id <> s.property_id;"
  "select 'cross_property_orders_amenities', count(*) from orders o join amenity_reservations ar on ar.id = o.amenity_reservation_id where o.amenity_reservation_id is not null and o.property_id <> ar.property_id;"
  "select 'cross_property_order_items_orders', count(*) from order_items oi join orders o on o.id = oi.order_id where oi.property_id <> o.property_id;"
  "select 'cross_property_order_items_menu_items', count(*) from order_items oi join menu_items mi on mi.id = oi.menu_item_id where oi.property_id <> mi.property_id;"
  "select 'cross_property_order_items_variants', count(*) from order_items oi join menu_item_variants v on v.id = oi.menu_item_variant_id where oi.menu_item_variant_id is not null and oi.property_id <> v.property_id;"
  "select 'cross_property_customer_orders_orders', count(*) from customer_orders co join orders o on o.id = co.order_id where co.property_id <> o.property_id;"
  "select 'cross_property_customer_order_commands_orders', count(*) from customer_order_commands c join orders o on o.id = c.order_id where c.property_id <> o.property_id;"
  "select 'cross_property_customer_reservation_commands_reservations', count(*) from customer_reservation_commands c join reservations r on r.id = c.reservation_id where c.property_id <> r.property_id;"
  "select 'cross_property_menu_categories_import_runs', count(*) from menu_categories c join menu_import_runs r on r.id = c.last_import_run_id where c.last_import_run_id is not null and c.property_id <> r.property_id;"
  "select 'cross_property_menu_items_categories', count(*) from menu_items mi join menu_categories c on c.id = mi.category_id where mi.category_id is not null and mi.property_id <> c.property_id;"
  "select 'cross_property_menu_items_stations', count(*) from menu_items mi join production_stations s on s.id = mi.production_station_id where mi.production_station_id is not null and mi.property_id <> s.property_id;"
  "select 'cross_property_menu_items_import_runs', count(*) from menu_items mi join menu_import_runs r on r.id = mi.last_import_run_id where mi.last_import_run_id is not null and mi.property_id <> r.property_id;"
  "select 'cross_property_menu_variants_items', count(*) from menu_item_variants v join menu_items mi on mi.id = v.menu_item_id where v.property_id <> mi.property_id;"
  "select 'cross_property_menu_variants_import_runs', count(*) from menu_item_variants v join menu_import_runs r on r.id = v.last_import_run_id where v.last_import_run_id is not null and v.property_id <> r.property_id;"
  "select 'cross_property_menu_ingredients_items', count(*) from menu_item_ingredients i join menu_items mi on mi.id = i.menu_item_id where i.property_id <> mi.property_id;"
  "select 'cross_property_menu_ingredients_inventory', count(*) from menu_item_ingredients i join inventory_items ii on ii.id = i.inventory_item_id where i.property_id <> ii.property_id;"
  "select 'cross_property_inventory_ledger_items', count(*) from inventory_ledger l join inventory_items i on i.id = l.inventory_item_id where l.property_id <> i.property_id;"
  "select 'orphan_inventory_suppliers', count(*) from inventory_items i where i.supplier_id is not null and not exists (select 1 from suppliers s where s.id::text = i.supplier_id and s.property_id = i.property_id);"
  "select 'cross_property_supplier_bank_details', count(*) from supplier_bank_details b join suppliers s on s.id = b.supplier_id where b.property_id <> s.property_id;"
  "select 'cross_property_purchase_orders_suppliers', count(*) from purchase_orders p join suppliers s on s.id = p.supplier_id where p.property_id <> s.property_id;"
  "select 'orphan_purchase_order_issuers', count(*) from purchase_orders p where p.issued_by_account_id is not null and not exists (select 1 from accounts a where a.id = p.issued_by_account_id);"
  "select 'cross_property_purchase_order_issuers', count(*) from purchase_orders p join accounts a on a.id = p.issued_by_account_id where p.issued_by_account_id is not null and p.property_id <> a.property_id;"
  "select 'cross_property_identity_documents_guests', count(*) from identity_documents d join guests g on g.id = d.guest_id where d.property_id <> g.property_id;"
  "select 'cross_property_stay_guests_stays', count(*) from stay_guests sg join stays s on s.id = sg.stay_id where sg.property_id <> s.property_id;"
  "select 'cross_property_stay_guests_guests', count(*) from stay_guests sg join guests g on g.id = sg.guest_id where sg.property_id <> g.property_id;"
  "select 'cross_property_folios_stays', count(*) from folios f join stays s on s.id = f.stay_id where f.property_id <> s.property_id;"
  "select 'cross_property_folio_entries_folios', count(*) from folio_entries fe join folios f on f.id = fe.folio_id where fe.property_id <> f.property_id;"
  "select 'cross_property_folio_entries_stays', count(*) from folio_entries fe join stays s on s.id = fe.stay_id where fe.property_id <> s.property_id;"
  "select 'cross_property_customer_guest_identities_guests', count(*) from customer_guest_identities c join guests g on g.id = c.guest_id where c.property_id <> g.property_id;"
  "select 'cross_property_customer_reservations_reservations', count(*) from customer_reservations c join reservations r on r.id = c.reservation_id where c.property_id <> r.property_id;"
  "select 'cross_property_outbox_stays', count(*) from outbox_events o join stays s on s.id = o.stay_id where o.stay_id is not null and o.property_id is not null and o.property_id <> s.property_id;"
  "select 'schema_sentinel', coalesce((select version from schema_sentinels where key = 'application_schema'), 'missing');"
  "select 'latest_migration', coalesce((select created_at::text from drizzle.__drizzle_migrations order by created_at desc limit 1), 'missing');"
)

$auditSql = $queries -join [Environment]::NewLine
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U $databaseUser -d $DatabaseName -Atc $auditSql
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL audit query failed.' }
