-- Add new action types to the activity_action_type enum for category and subcategory management
ALTER TYPE activity_action_type ADD VALUE IF NOT EXISTS 'category_created';
ALTER TYPE activity_action_type ADD VALUE IF NOT EXISTS 'category_updated';
ALTER TYPE activity_action_type ADD VALUE IF NOT EXISTS 'category_deleted';
ALTER TYPE activity_action_type ADD VALUE IF NOT EXISTS 'subcategory_created';
ALTER TYPE activity_action_type ADD VALUE IF NOT EXISTS 'subcategory_updated';
ALTER TYPE activity_action_type ADD VALUE IF NOT EXISTS 'subcategory_deleted';
ALTER TYPE activity_action_type ADD VALUE IF NOT EXISTS 'sale_deleted';
ALTER TYPE activity_action_type ADD VALUE IF NOT EXISTS 'sale_cancelled';