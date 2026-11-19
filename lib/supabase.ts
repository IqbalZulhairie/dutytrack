import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./supabase/config";

const { url, publishableKey } = getSupabaseConfig();
const supabase = createClient(url, publishableKey);

export default supabase;