-- Check if the trigger exists and is working

-- 1. Check if the trigger function exists
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name = 'handle_new_user';

-- 2. Check if the trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'users'
    AND trigger_schema = 'auth';

-- 3. Check for Apple user
SELECT 
    id,
    email,
    raw_app_meta_data->>'provider' as provider,
    raw_user_meta_data->>'full_name' as full_name,
    created_at
FROM auth.users
WHERE id = 'b0fb872d-be96-42d6-943b-e6ab317d330a';

-- 4. Check if profile exists for Apple user
SELECT 
    id,
    display_name,
    avatar_url,
    created_at
FROM public.profiles
WHERE id = 'b0fb872d-be96-42d6-943b-e6ab317d330a';

-- 5. If profile doesn't exist, create it manually
INSERT INTO public.profiles (id, display_name, avatar_url, is_supporter)
SELECT 
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', 'User'),
    COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
    false
FROM auth.users u
WHERE u.id = 'b0fb872d-be96-42d6-943b-e6ab317d330a'
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- 6. Verify it was created
SELECT 
    u.id,
    u.email,
    u.raw_app_meta_data->>'provider' as provider,
    p.display_name,
    p.avatar_url,
    CASE 
        WHEN p.id IS NULL THEN 'MISSING'
        ELSE 'EXISTS'
    END as profile_status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.id = 'b0fb872d-be96-42d6-943b-e6ab317d330a';
