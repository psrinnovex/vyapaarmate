-- Images are served through the application route, not the Supabase Data API.
ALTER TABLE "MenuItemImage" ENABLE ROW LEVEL SECURITY;
