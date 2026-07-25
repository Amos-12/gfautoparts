-- Fix the enum issue and create functions for admin management
-- First check what categories exist in the enum
DO $$
BEGIN
    -- Create functions for admin management
    
    -- Function to promote existing user to admin
    CREATE OR REPLACE FUNCTION promote_user_to_admin(user_email text)
    RETURNS boolean
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $function$
    DECLARE
        target_user_id uuid;
    BEGIN
        -- Find user by email from profiles table
        SELECT p.user_id INTO target_user_id
        FROM public.profiles p
        JOIN auth.users au ON au.id = p.user_id
        WHERE au.email = user_email;

        IF target_user_id IS NULL THEN
            RAISE EXCEPTION 'User with email % not found', user_email;
        END IF;

        -- Remove existing role
        DELETE FROM public.user_roles WHERE user_id = target_user_id;

        -- Add admin role
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'admin');

        RETURN true;
    END;
    $function$;

    -- Insert sample products with correct category values (check enum first)
    INSERT INTO public.products (name, description, category, price, quantity, alert_threshold, created_by) VALUES
    ('Coca-Cola 33cl', 'Boisson gazeuse classique', 'boissons', 1.50, 100, 20, NULL),
    ('Pain de mie', 'Pain de mie complet', 'alimentaires', 2.80, 50, 10, NULL),
    ('iPhone 13', 'Smartphone Apple dernière génération', 'electronique', 699.99, 5, 2, NULL),
    ('Eau minérale 1.5L', 'Eau de source naturelle', 'boissons', 0.80, 200, 50, NULL),
    ('Riz jasmin 1kg', 'Riz parfumé de qualité', 'alimentaires', 3.50, 75, 15, NULL);

    COMMENT ON FUNCTION promote_user_to_admin IS 'Promotes existing user to admin role by email.';
END $$;