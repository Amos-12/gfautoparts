-- Add missing activity action types to the enum
ALTER TYPE activity_action_type ADD VALUE IF NOT EXISTS 'user_deleted';
ALTER TYPE activity_action_type ADD VALUE IF NOT EXISTS 'system_cleanup';
