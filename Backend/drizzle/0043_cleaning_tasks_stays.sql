ALTER TABLE "cleaning_tasks" ADD COLUMN IF NOT EXISTS "stay_id" uuid;

WITH current_tasks AS (
  SELECT task.id, task.property_id, task.room_id,
    row_number() OVER (PARTITION BY task.property_id, task.room_id ORDER BY task.created_at DESC, task.id DESC) AS position
  FROM cleaning_tasks task
  JOIN rooms room ON room.id = task.room_id AND room.property_id = task.property_id
  WHERE task.stay_id IS NULL
    AND task.status <> 'approved'
    AND room.status = 'cleaning'
), latest_stays AS (
  SELECT current_tasks.id AS task_id,
    (SELECT stay.id
      FROM stays stay
      WHERE stay.property_id = current_tasks.property_id
        AND stay.room_id = current_tasks.room_id
        AND stay.status = 'checked_out'
      ORDER BY stay.check_out_at DESC
      LIMIT 1) AS stay_id
  FROM current_tasks
  WHERE current_tasks.position = 1
)
UPDATE cleaning_tasks task
SET stay_id = latest_stays.stay_id
FROM latest_stays
WHERE task.id = latest_stays.task_id
  AND latest_stays.stay_id IS NOT NULL;

ALTER TABLE "cleaning_tasks"
  ADD CONSTRAINT "cleaning_tasks_stay_property_fkey"
  FOREIGN KEY ("stay_id", "property_id") REFERENCES "stays"("id", "property_id") ON DELETE RESTRICT;

CREATE UNIQUE INDEX "cleaning_tasks_stay_unique" ON "cleaning_tasks" ("stay_id") WHERE "stay_id" IS NOT NULL;
