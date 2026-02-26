-- Schema for GazeAssist PostgreSQL (optional - run when DATABASE_URL is set)
-- Usage: psql $DATABASE_URL -f server/schema.sql

CREATE TABLE IF NOT EXISTS calibration_sessions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  calibration_data JSONB,
  calibration_model JSONB,
  quality_score DECIMAL(10, 4),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calibration_sessions_user_id ON calibration_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_calibration_sessions_created_at ON calibration_sessions(created_at);
