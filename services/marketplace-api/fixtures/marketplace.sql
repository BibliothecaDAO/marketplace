PRAGMA journal_mode = WAL;

CREATE TABLE contracts (
  id TEXT PRIMARY KEY,
  head INTEGER NOT NULL
);

CREATE TABLE transactions (
  transaction_hash TEXT PRIMARY KEY,
  block_number INTEGER NOT NULL,
  sender_address TEXT NOT NULL,
  calldata TEXT
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  transaction_hash TEXT NOT NULL,
  event_index INTEGER NOT NULL
);

CREATE TABLE "ARCADE-Order" (
  internal_entity_id TEXT PRIMARY KEY,
  internal_event_id TEXT NOT NULL,
  id INTEGER NOT NULL,
  collection TEXT NOT NULL,
  token_id TEXT NOT NULL,
  royalties INTEGER NOT NULL,
  category INTEGER NOT NULL,
  status INTEGER NOT NULL,
  expiration TEXT NOT NULL,
  quantity TEXT NOT NULL,
  price TEXT NOT NULL,
  currency TEXT NOT NULL,
  owner TEXT NOT NULL
);

CREATE TABLE marketplace_order_audit (
  entity_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  quantity TEXT NOT NULL,
  PRIMARY KEY (entity_id, sequence)
);

CREATE TABLE "ARCADE-Book" (
  id INTEGER PRIMARY KEY,
  internal_event_id TEXT NOT NULL,
  version TEXT NOT NULL,
  paused INTEGER NOT NULL,
  royalties INTEGER NOT NULL,
  counter TEXT NOT NULL,
  fee_num TEXT NOT NULL,
  fee_receiver TEXT NOT NULL
);

CREATE TABLE marketplace_book_audit (
  sequence INTEGER PRIMARY KEY,
  event_id TEXT NOT NULL,
  version TEXT NOT NULL,
  paused INTEGER NOT NULL,
  royalties INTEGER NOT NULL,
  counter TEXT NOT NULL,
  fee_num TEXT NOT NULL,
  fee_receiver TEXT NOT NULL
);

INSERT INTO contracts (id, head) VALUES
  ('0x07a079295990e43441a7389fdc3b9ba063c6cd6aee16fb846f598c42a9f04ff7', 110);

INSERT INTO transactions (transaction_hash, block_number, sender_address, calldata) VALUES
  ('0x0100', 100, '0x0abc', '[]'),
  ('0x0101', 101, '0x0abc', '[]'),
  ('0x0102', 102, '0x0abc', '[]'),
  ('0x0103', 103, '0x0abc', '[]'),
  ('0x0104', 104, '0x0abc', '[]'),
  ('0x0105', 105, '0x0abc', '[]'),
  ('0x0106', 106, '0x0abc', '[]'),
  ('0x0107', 107, '0x0abc', '[]');

INSERT INTO events (id, transaction_hash, event_index) VALUES
  ('100:0:0', '0x0100', 0),
  ('101:0:0', '0x0101', 0),
  ('102:0:0', '0x0102', 0),
  ('103:0:0', '0x0103', 0),
  ('104:0:0', '0x0104', 0),
  ('105:0:0', '0x0105', 0),
  ('106:0:0', '0x0106', 0),
  ('107:0:0', '0x0107', 0);

INSERT INTO "ARCADE-Order" (
  internal_entity_id,
  internal_event_id,
  id,
  collection,
  token_id,
  royalties,
  category,
  status,
  expiration,
  quantity,
  price,
  currency,
  owner
) VALUES
  ('order-active', '101:0:0', 7, '0x07ae27a31bb6526e3de9cf02f081f6ce0615ac12a6d7b85ee58b8ad7947a2809', '0x000000000000000000000000000000000000000000000000000000000000002a', 1, 2, 1, '0x0000000000001000', '1', '100', '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d', '0x0abc'),
  ('order-cancelled', '102:0:0', 8, '0x07ae27a31bb6526e3de9cf02f081f6ce0615ac12a6d7b85ee58b8ad7947a2809', '0x000000000000000000000000000000000000000000000000000000000000002b', 1, 2, 2, '0x0000000000001000', '1', '110', '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d', '0x0abc'),
  ('order-executed', '103:0:0', 9, '0x07ae27a31bb6526e3de9cf02f081f6ce0615ac12a6d7b85ee58b8ad7947a2809', '0x000000000000000000000000000000000000000000000000000000000000002c', 1, 2, 3, '0x0000000000001000', '0', '120', '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d', '0x0abc'),
  ('order-expired', '104:0:0', 10, '0x07ae27a31bb6526e3de9cf02f081f6ce0615ac12a6d7b85ee58b8ad7947a2809', '0x000000000000000000000000000000000000000000000000000000000000002d', 1, 2, 1, '0x0000000000000001', '1', '130', '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d', '0x0abc'),
  ('order-partial', '105:0:0', 11, '0x07ae27a31bb6526e3de9cf02f081f6ce0615ac12a6d7b85ee58b8ad7947a2809', '0x000000000000000000000000000000000000000000000000000000000000002e', 1, 2, 1, '0x0000000000001000', '1', '140', '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d', '0x0abc');

INSERT INTO marketplace_order_audit (entity_id, event_id, sequence, quantity) VALUES
  ('order-active', '100:0:0', 1, '1'),
  ('order-cancelled', '100:0:0', 1, '1'),
  ('order-executed', '100:0:0', 1, '1'),
  ('order-expired', '100:0:0', 1, '1'),
  ('order-partial', '100:0:0', 1, '2'),
  ('order-partial', '105:0:0', 2, '1');

INSERT INTO "ARCADE-Book" (
  id,
  internal_event_id,
  version,
  paused,
  royalties,
  counter,
  fee_num,
  fee_receiver
) VALUES (1, '107:0:0', '2', 0, 1, '12', '250', '0x0fee');

INSERT INTO marketplace_book_audit (
  sequence,
  event_id,
  version,
  paused,
  royalties,
  counter,
  fee_num,
  fee_receiver
) VALUES
  (1, '106:0:0', '1', 0, 1, '11', '200', '0x0fee'),
  (2, '107:0:0', '2', 0, 1, '12', '250', '0x0fee');
