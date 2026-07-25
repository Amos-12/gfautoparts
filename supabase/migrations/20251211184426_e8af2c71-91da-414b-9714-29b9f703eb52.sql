-- Enable REPLICA IDENTITY FULL to capture all row data in real-time updates
ALTER TABLE products REPLICA IDENTITY FULL;

-- Add products table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE products;