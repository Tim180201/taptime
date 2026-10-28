// Exact pre-T137 invoker queries; same RLS, rows and ordering are the equality oracle.
export const initial = `WITH setup_items AS (
             SELECT
               0::integer AS kind_order,
               customer.id,
               customer.display_name,
               customer.active,
               NULL::text AS validation_fingerprint,
               NULL::uuid AS target_customer_id,
               NULL::uuid AS active_assignment_id,
               NULL::text AS assignment_type
             FROM taptime_server.customers AS customer
             WHERE customer.organization_id = $1 AND customer.active
             UNION ALL
             SELECT
               1::integer AS kind_order,
               tag.id,
               tag.display_name,
               NULL::boolean AS active,
               tag.validation_fingerprint,
               assignment.target_customer_id,
               assignment.id AS active_assignment_id,
               assignment.assignment_type
             FROM taptime_server.nfc_tags AS tag
             LEFT JOIN taptime_server.nfc_assignments AS assignment
               ON assignment.organization_id = tag.organization_id
              AND assignment.nfc_tag_id = tag.id
              AND assignment.active
             WHERE tag.organization_id = $1
           )
           SELECT
             kind_order,
             id,
             display_name,
             active,
             validation_fingerprint,
             target_customer_id,
             active_assignment_id,
             assignment_type
           FROM setup_items
           WHERE $2::integer IS NULL
              OR kind_order > $2
              OR (kind_order = $2 AND id > $3::uuid)
           ORDER BY kind_order, id
           LIMIT $4`;
export const tags = `SELECT 1 AS kind_order,tag.id,tag.display_name,NULL::boolean AS active,tag.validation_fingerprint,
          assignment.target_customer_id,assignment.id AS active_assignment_id,assignment.assignment_type,
          customer.display_name AS customer_display_name
        FROM taptime_server.nfc_tags AS tag
        LEFT JOIN taptime_server.nfc_assignments AS assignment
          ON assignment.organization_id=tag.organization_id AND assignment.nfc_tag_id=tag.id AND assignment.active
        LEFT JOIN taptime_server.customers AS customer
          ON customer.organization_id=assignment.organization_id AND customer.id=assignment.target_customer_id
        WHERE tag.organization_id=$1
          AND ($2::text IS NULL OR strpos(lower(tag.display_name COLLATE "und-x-icu"),lower($2::text COLLATE "und-x-icu"))>0
            OR strpos(lower(customer.display_name COLLATE "und-x-icu"),lower($2::text COLLATE "und-x-icu"))>0)
          AND ($3::text IS NULL OR (tag.display_name COLLATE "und-x-icu",tag.id)>($3::text COLLATE "und-x-icu",$4::uuid))
        ORDER BY tag.display_name COLLATE "und-x-icu",tag.id LIMIT $5`;
