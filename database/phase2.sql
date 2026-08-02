PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS availability_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS availability_exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  unavailable INTEGER NOT NULL DEFAULT 1,
  note TEXT
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  service TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (30,60)),
  booking_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  address TEXT NOT NULL,
  postcode TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','declined','completed','cancelled')),
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date,start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

INSERT INTO availability_rules (weekday,start_time,end_time)
SELECT 1,'19:00','21:00' WHERE NOT EXISTS (SELECT 1 FROM availability_rules);
INSERT INTO availability_rules (weekday,start_time,end_time)
SELECT 3,'19:00','21:00' WHERE (SELECT COUNT(*) FROM availability_rules)=1;
INSERT INTO availability_rules (weekday,start_time,end_time)
SELECT 6,'11:00','13:00' WHERE (SELECT COUNT(*) FROM availability_rules)=2;
INSERT INTO availability_rules (weekday,start_time,end_time)
SELECT 6,'16:00','19:00' WHERE (SELECT COUNT(*) FROM availability_rules)=3;
