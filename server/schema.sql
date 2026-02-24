-- Gaze Assist Database Schema
-- PostgreSQL Database Schema for Gaze Tracking System

-- ============================================================================
-- CALIBRATION SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS calibration_sessions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  calibration_data JSONB NOT NULL,
  calibration_model JSONB NOT NULL,
  quality_score DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calibration_user_id ON calibration_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_calibration_created_at ON calibration_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_calibration_quality ON calibration_sessions(quality_score);

-- ============================================================================
-- USERS TABLE (Optional - for user management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_calibration_at TIMESTAMP,
  total_calibrations INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- GAZE MODELS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS gaze_models (
  id SERIAL PRIMARY KEY,
  model_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  model_data JSONB NOT NULL,
  metadata JSONB,
  accuracy DECIMAL(10,2),
  sample_count INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_models_user_id ON gaze_models(user_id);
CREATE INDEX IF NOT EXISTS idx_models_model_id ON gaze_models(model_id);
CREATE INDEX IF NOT EXISTS idx_models_is_active ON gaze_models(is_active);

-- ============================================================================
-- PREDICTION LOGS TABLE (Optional - for analytics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS prediction_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  model_id VARCHAR(255),
  predicted_x DECIMAL(10,2),
  predicted_y DECIMAL(10,2),
  confidence DECIMAL(3,2),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Partition by date for better performance
CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON prediction_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_timestamp ON prediction_logs(timestamp);

-- ============================================================================
-- CALIBRATION QUALITY METRICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS calibration_quality_metrics (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES calibration_sessions(id) ON DELETE CASCADE,
  user_id VARCHAR(255),
  overall_score DECIMAL(3,2),
  avg_point_quality DECIMAL(3,2),
  min_point_quality DECIMAL(3,2),
  coverage DECIMAL(3,2),
  temporal_consistency DECIMAL(3,2),
  recommendation TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quality_session_id ON calibration_quality_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_quality_user_id ON calibration_quality_metrics(user_id);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for user statistics
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
  u.user_id,
  u.name,
  u.email,
  u.total_calibrations,
  u.last_calibration_at,
  COUNT(DISTINCT gm.id) as total_models,
  AVG(cqm.overall_score) as avg_calibration_quality,
  MAX(gm.accuracy) as best_model_accuracy
FROM users u
LEFT JOIN gaze_models gm ON u.user_id = gm.user_id
LEFT JOIN calibration_sessions cs ON u.user_id = cs.user_id
LEFT JOIN calibration_quality_metrics cqm ON cs.id = cqm.session_id
GROUP BY u.user_id, u.name, u.email, u.total_calibrations, u.last_calibration_at;

-- View for recent calibrations
CREATE OR REPLACE VIEW recent_calibrations AS
SELECT 
  cs.id,
  cs.user_id,
  cs.quality_score,
  cs.created_at,
  cqm.overall_score,
  cqm.recommendation,
  u.name as user_name
FROM calibration_sessions cs
LEFT JOIN calibration_quality_metrics cqm ON cs.id = cqm.session_id
LEFT JOIN users u ON cs.user_id = u.user_id
ORDER BY cs.created_at DESC
LIMIT 100;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update user's last calibration timestamp
CREATE OR REPLACE FUNCTION update_user_calibration_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users 
  SET 
    last_calibration_at = NEW.created_at,
    total_calibrations = total_calibrations + 1
  WHERE user_id = NEW.user_id;
  
  -- Create user if doesn't exist
  IF NOT FOUND THEN
    INSERT INTO users (user_id, last_calibration_at, total_calibrations)
    VALUES (NEW.user_id, NEW.created_at, 1);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update user stats on new calibration
CREATE TRIGGER trigger_update_user_calibration_stats
AFTER INSERT ON calibration_sessions
FOR EACH ROW
EXECUTE FUNCTION update_user_calibration_stats();

-- Function to clean up old prediction logs (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_prediction_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM prediction_logs
  WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function to get user's best model
CREATE OR REPLACE FUNCTION get_user_best_model(p_user_id VARCHAR)
RETURNS TABLE (
  model_id VARCHAR,
  accuracy DECIMAL,
  sample_count INTEGER,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gm.model_id,
    gm.accuracy,
    gm.sample_count,
    gm.created_at
  FROM gaze_models gm
  WHERE gm.user_id = p_user_id
    AND gm.is_active = true
  ORDER BY gm.accuracy ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Insert sample user
INSERT INTO users (user_id, email, name) 
VALUES ('test_user', 'test@example.com', 'Test User')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- MAINTENANCE QUERIES
-- ============================================================================

-- Clean up old calibration sessions (older than 90 days)
-- DELETE FROM calibration_sessions WHERE created_at < NOW() - INTERVAL '90 days';

-- Clean up inactive models
-- DELETE FROM gaze_models WHERE is_active = false AND created_at < NOW() - INTERVAL '30 days';

-- Get calibration quality distribution
-- SELECT 
--   CASE 
--     WHEN quality_score >= 0.9 THEN 'Excellent'
--     WHEN quality_score >= 0.8 THEN 'Good'
--     WHEN quality_score >= 0.7 THEN 'Fair'
--     ELSE 'Poor'
--   END as quality_category,
--   COUNT(*) as count
-- FROM calibration_sessions
-- GROUP BY quality_category;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Analyze tables for query optimization
ANALYZE calibration_sessions;
ANALYZE users;
ANALYZE gaze_models;
ANALYZE prediction_logs;
ANALYZE calibration_quality_metrics;

-- ============================================================================
-- BACKUP RECOMMENDATIONS
-- ============================================================================

-- Regular backups recommended:
-- pg_dump -U username -d gazeassist -F c -f backup_$(date +%Y%m%d).dump

-- Restore from backup:
-- pg_restore -U username -d gazeassist -c backup_YYYYMMDD.dump

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. The database is OPTIONAL - the backend works without it using in-memory storage
-- 2. JSONB columns allow flexible storage of calibration data and models
-- 3. Indexes are optimized for common query patterns
-- 4. Triggers automatically maintain user statistics
-- 5. Views provide convenient access to aggregated data
-- 6. Functions enable complex queries and maintenance tasks
-- 7. Consider partitioning prediction_logs by date for large-scale deployments
