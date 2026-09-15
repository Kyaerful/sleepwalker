CREATE TABLE walkingpad_slots (
  pad text NOT NULL CHECK (pad IN ('SWIFT','TEMPO','PACER')),
  day date NOT NULL CHECK (extract(isodow FROM day) BETWEEN 1 AND 5),
  minute integer NOT NULL CHECK (minute >= 540 AND minute < 1080 AND minute % 30 = 0),
  booking_id uuid NOT NULL,
  start_minute integer NOT NULL CHECK (start_minute >= 540 AND start_minute % 30 = 0),
  duration integer NOT NULL CHECK (duration IN (30,60)),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pad, day, minute),
  CHECK (start_minute + duration <= 1080),
  CHECK (minute >= start_minute AND minute < start_minute + duration),
  UNIQUE (booking_id, minute)
);
CREATE INDEX walkingpad_slots_booking_id ON walkingpad_slots (booking_id);
