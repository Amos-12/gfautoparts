-- Direct insertion of admin role for existing user
INSERT INTO public.user_roles (user_id, role) 
VALUES ('1f1b6793-15c8-45e6-ac07-b9960011c887', 'admin') 
ON CONFLICT (user_id, role) DO NOTHING;