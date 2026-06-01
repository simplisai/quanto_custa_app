// Script para seed das configs v1 de todos os simuladores
// Executa: npx tsx scripts/seed-simulator-configs.ts
import { createClient } from "@supabase/supabase-js";
import { SEED_CONFIGS } from "../src/lib/simulator-seed-configs";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("🚀 Iniciando seed de simulator_configs...\n");

  for (const cfg of SEED_CONFIGS) {
    // Check if any version already exists for this slug
    const { data: existing } = await supabase
      .from("simulator_configs")
      .select("id, version_number, is_published")
      .eq("slug", cfg.slug)
      .order("version_number", { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`⏭  ${cfg.slug} — já existe v${existing[0].version_number} (publicada: ${existing[0].is_published})`);
      continue;
    }

    const { error } = await supabase.from("simulator_configs").insert({
      slug: cfg.slug,
      version_number: 1,
      version_label: cfg.version_label,
      notes: cfg.notes,
      config: cfg.config as unknown as Record<string, unknown>,
      is_published: true, // publicada imediatamente
    });

    if (error) {
      console.error(`❌ ${cfg.slug} — ${error.message}`);
    } else {
      console.log(`✅ ${cfg.slug} — v1 criada e publicada`);
    }
  }

  console.log("\n✓ Seed concluído. Acesse /admin/simuladores para verificar.");
}

run().catch(console.error);
