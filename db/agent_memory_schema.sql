-- Agent Memory Tables for Production-Ready Multi-Agent System
-- Based on 2025 Best Practices for AI Agent Memory Management

-- Thread Memory Table (Short-term conversation memory)
CREATE TABLE IF NOT EXISTS agent_thread_memory (
  id SERIAL PRIMARY KEY,
  thread_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  last_agent VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

-- User Profile Memory Table (Long-term user preferences and history)
CREATE TABLE IF NOT EXISTS agent_user_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preferences JSONB DEFAULT '{}',
  resume_analyses JSONB DEFAULT '[]',
  search_history JSONB DEFAULT '[]',
  interview_history JSONB DEFAULT '[]',
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent Memory Events Table (For importance scoring and decay)
CREATE TABLE IF NOT EXISTS agent_memory_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'resume_analysis', 'job_search', 'interview_prep', etc.
  event_data JSONB NOT NULL,
  importance_score DECIMAL(3,2) DEFAULT 0.5, -- 0.0 to 1.0
  access_count INTEGER DEFAULT 0,
  embedding VECTOR(1536), -- For future semantic search with pgvector
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent Checkpoints Table (For error recovery and state persistence)
CREATE TABLE IF NOT EXISTS agent_checkpoints (
  id SERIAL PRIMARY KEY,
  thread_id VARCHAR(255) NOT NULL,
  checkpoint_data JSONB NOT NULL,
  agent_name VARCHAR(100),
  step_number INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent Task Results Table (ADK-style task result storage)
CREATE TABLE IF NOT EXISTS agent_task_results (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  thread_id VARCHAR(255),
  agent_name VARCHAR(100) NOT NULL,
  task VARCHAR(255) NOT NULL,
  result TEXT,
  confidence DECIMAL(3,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_thread_memory_thread_id ON agent_thread_memory(thread_id);
CREATE INDEX IF NOT EXISTS idx_agent_thread_memory_user_id ON agent_thread_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_thread_memory_expires_at ON agent_thread_memory(expires_at);
CREATE INDEX IF NOT EXISTS idx_agent_user_profiles_user_id ON agent_user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_events_user_id ON agent_memory_events(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_events_event_type ON agent_memory_events(event_type);
CREATE INDEX IF NOT EXISTS idx_agent_memory_events_importance ON agent_memory_events(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_agent_checkpoints_thread_id ON agent_checkpoints(thread_id);
CREATE INDEX IF NOT EXISTS idx_agent_task_results_user_id ON agent_task_results(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_task_results_thread_id ON agent_task_results(thread_id);

-- Add GIN index for JSONB columns for faster queries
CREATE INDEX IF NOT EXISTS idx_agent_user_profiles_preferences_gin ON agent_user_profiles USING GIN (preferences);
CREATE INDEX IF NOT EXISTS idx_agent_user_profiles_resume_gin ON agent_user_profiles USING GIN (resume_analyses);
CREATE INDEX IF NOT EXISTS idx_agent_user_profiles_search_gin ON agent_user_profiles USING GIN (search_history);

-- Function to calculate memory retention score (importance-based decay)
CREATE OR REPLACE FUNCTION calculate_retention_score(
  created_date TIMESTAMP,
  importance DECIMAL,
  access_count INTEGER
) RETURNS DECIMAL AS $$
DECLARE
  age_days INTEGER;
  age_factor DECIMAL;
  usage_factor DECIMAL;
  max_access CONSTANT INTEGER := 100;
BEGIN
  age_days := EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_date));
  -- Exponential decay with 30-day half-life
  age_factor := EXP(-age_days::DECIMAL / 30);
  -- Usage factor normalized to 0-1
  usage_factor := LEAST(access_count::DECIMAL / max_access, 1.0);
  
  RETURN ROUND((age_factor * importance * (0.5 + 0.5 * usage_factor))::DECIMAL, 3);
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired memories
CREATE OR REPLACE FUNCTION cleanup_expired_memories() RETURNS void AS $$
BEGIN
  -- Delete expired thread memories
  DELETE FROM agent_thread_memory WHERE expires_at < CURRENT_TIMESTAMP;
  
  -- Archive old memory events with low retention score
  DELETE FROM agent_memory_events 
  WHERE calculate_retention_score(created_at, importance_score, access_count) < 0.1
  AND created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_agent_thread_memory_updated_at ON agent_thread_memory;
CREATE TRIGGER update_agent_thread_memory_updated_at 
  BEFORE UPDATE ON agent_thread_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agent_user_profiles_updated_at ON agent_user_profiles;
CREATE TRIGGER update_agent_user_profiles_updated_at 
  BEFORE UPDATE ON agent_user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a scheduled job to run cleanup (requires pg_cron extension in production)
-- In development, we'll call this manually or via a cron job
-- SELECT cron.schedule('cleanup-expired-memories', '0 */6 * * *', 'SELECT cleanup_expired_memories();');