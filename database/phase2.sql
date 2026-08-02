PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS households (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  town TEXT NOT NULL DEFAULT 'Andover',
  postcode TEXT NOT NULL,
  broadband_provider TEXT,
  router_model TEXT,
  wifi_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  relationship TEXT,
  is_primary INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL
);

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
  household_id INTEGER,
  customer_id INTEGER,
  service TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (30,60)),
  booking_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT NOT NULL,
  address TEXT,
  postcode TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','declined','completed','cancelled')),
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER,
  household_id INTEGER,
  summary TEXT,
  actions_taken TEXT,
  follow_up_date TEXT,
  completed_at TEXT,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customers_household ON customers(household_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date,start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_visits_household ON visits(household_id);

INSERT INTO availability_rules (weekday,start_time,end_time)
SELECT 1,'19:00','21:00' WHERE NOT EXISTS (SELECT 1 FROM availability_rules);
INSERT INTO availability_rules (weekday,start_time,end_time)
SELECT 3,'19:00','21:00' WHERE (SELECT COUNT(*) FROM availability_rules)=1;
INSERT INTO availability_rules (weekday,start_time,end_time)
SELECT 6,'11:00','13:00' WHERE (SELECT COUNT(*) FROM availability_rules)=2;
INSERT INTO availability_rules (weekday,start_time,end_time)
SELECT 6,'16:00','19:00' WHERE (SELECT COUNT(*) FROM availability_rules)=3;
