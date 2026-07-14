CREATE TABLE IF NOT EXISTS marketplace_order_audit (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id TEXT NOT NULL,
    event_id TEXT NOT NULL UNIQUE,
    order_id TEXT NOT NULL,
    collection TEXT NOT NULL,
    token_id TEXT NOT NULL,
    royalties INTEGER NOT NULL,
    category INTEGER NOT NULL,
    status INTEGER NOT NULL,
    expiration TEXT NOT NULL,
    quantity TEXT NOT NULL,
    price TEXT NOT NULL,
    currency TEXT NOT NULL,
    owner TEXT NOT NULL,
    captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_marketplace_order_audit_identity
ON marketplace_order_audit (order_id, collection, token_id, sequence);

CREATE INDEX IF NOT EXISTS idx_marketplace_order_audit_event
ON marketplace_order_audit (event_id);

CREATE TABLE IF NOT EXISTS marketplace_book_audit (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id TEXT NOT NULL,
    event_id TEXT NOT NULL UNIQUE,
    book_id TEXT NOT NULL,
    version TEXT NOT NULL,
    paused INTEGER NOT NULL,
    royalties INTEGER NOT NULL,
    counter TEXT NOT NULL,
    fee_num TEXT NOT NULL,
    fee_receiver TEXT NOT NULL,
    captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_marketplace_book_audit_event
ON marketplace_book_audit (event_id);

CREATE TABLE IF NOT EXISTS marketplace_metadata_failures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection TEXT NOT NULL,
    token_id TEXT,
    uri TEXT NOT NULL,
    reason TEXT NOT NULL,
    warning TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    first_failed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_failed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_marketplace_metadata_failures_unresolved
ON marketplace_metadata_failures (resolved_at, collection, token_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_metadata_failure_active
ON marketplace_metadata_failures (collection, token_id)
WHERE resolved_at IS NULL;

CREATE VIEW IF NOT EXISTS marketplace_token_activity_v1 AS
WITH sequenced_orders AS (
    SELECT
        audit.*,
        LAG(audit.event_id) OVER identity_order AS previous_event_id,
        LAG(audit.status) OVER identity_order AS previous_status,
        LAG(audit.quantity) OVER identity_order AS previous_quantity
    FROM marketplace_order_audit audit
    WINDOW identity_order AS (
        PARTITION BY audit.order_id, audit.collection, audit.token_id
        ORDER BY audit.sequence ASC
    )
),
order_activity AS (
    SELECT
        CASE
            WHEN audit.previous_event_id IS NULL AND audit.category = 2 THEN 'listing_created'
            WHEN audit.previous_event_id IS NULL AND audit.category IN (1, 3) THEN 'offer_created'
            WHEN audit.status = 3 THEN 'sale'
            WHEN audit.status = 2 THEN 'order_status_changed'
            WHEN audit.status = 1
                AND audit.previous_quantity IS NOT NULL
                AND audit.quantity < audit.previous_quantity
                THEN 'order_partially_filled'
            ELSE 'unknown'
        END AS raw_type,
        'order_snapshot:' || audit.status AS type_raw,
        audit.collection,
        audit.token_id,
        audit.order_id,
        audit.owner,
        NULL AS from_address,
        NULL AS to_address,
        audit.category,
        audit.currency,
        audit.price,
        audit.quantity AS activity_quantity,
        audit.previous_quantity,
        audit.event_id,
        event.transaction_hash,
        COALESCE(event.block_number, tx.block_number, 0) AS block_number,
        COALESCE(event.event_index, 0) AS event_index,
        COALESCE((
            SELECT COUNT(*)
            FROM transactions preceding
            WHERE preceding.block_number = tx.block_number
              AND preceding.rowid < tx.rowid
        ), 0) AS transaction_index,
        tx.sender_address AS caller
    FROM sequenced_orders audit
    JOIN events event ON event.id = audit.event_id
    JOIN transactions tx ON tx.transaction_hash = event.transaction_hash
),
transfer_activity AS (
    SELECT
        'transfer' AS raw_type,
        'erc_transfer' AS type_raw,
        transfer.contract_address AS collection,
        token.token_id,
        NULL AS order_id,
        NULL AS owner,
        transfer.from_address,
        transfer.to_address,
        NULL AS category,
        NULL AS currency,
        NULL AS price,
        transfer.amount AS activity_quantity,
        NULL AS previous_quantity,
        transfer.event_id,
        event.transaction_hash,
        COALESCE(event.block_number, tx.block_number, 0) AS block_number,
        COALESCE(event.event_index, 0) AS event_index,
        COALESCE((
            SELECT COUNT(*)
            FROM transactions preceding
            WHERE preceding.block_number = tx.block_number
              AND preceding.rowid < tx.rowid
        ), 0) AS transaction_index,
        tx.sender_address AS caller
    FROM token_transfers transfer
    JOIN tokens token ON token.id = transfer.token_id
    JOIN events event ON event.id = transfer.event_id
    JOIN transactions tx ON tx.transaction_hash = event.transaction_hash
)
SELECT * FROM order_activity
UNION ALL
SELECT * FROM transfer_activity;
