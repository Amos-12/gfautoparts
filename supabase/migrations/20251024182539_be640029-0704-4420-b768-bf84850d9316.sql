-- Add new activity action types to the enum
ALTER TYPE activity_action_type ADD VALUE IF NOT EXISTS 'user_login';
ALTER TYPE activity_action_type ADD VALUE IF NOT EXISTS 'user_logout';
ALTER TYPE activity_action_type ADD VALUE IF NOT EXISTS 'user_signup';
ALTER TYPE activity_action_type ADD VALUE IF NOT EXISTS 'user_update_password';
ALTER TYPE activity_action_type ADD VALUE IF NOT EXISTS 'connection_failed';
ALTER TYPE activity_action_type ADD VALUE IF NOT EXISTS 'product_deleted';
-- Add product_deactivated to activity_action_type enum
ALTER TYPE activity_action_type ADD VALUE IF NOT EXISTS 'product_deactivated';