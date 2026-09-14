import { supabase } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/supabase/session";
import { renderTemplate, type PlaceholderValues } from "@/lib/onboarding";
import type { OnboardingDocument } from "@/lib/supabase/types";

/* ------------------------------------------------------- templates (authoring) */

export async function getOnboardingDocuments() {
  const { data, error } = await supabase
    .from("onboarding_documents")
    .select("*")
    .order("name");

  if (error) throw error;
  return data;
}

export async function createOnboardingDocument(name: string, body: string) {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("onboarding_documents")
    .insert({ user_id: userId, name, body })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateOnboardingDocument(
  id: string,
  name: string,
  body: string
) {
  const { error } = await supabase
    .from("onboarding_documents")
    .update({ name, body, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteOnboardingDocument(id: string) {
  const { error } = await supabase
    .from("onboarding_documents")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/* ----------------------------------------------------------- tier attachment */

/** Counts rows rather than using `{ count: "exact", head: true }`: that reads
 * the total from the content-range header, which only works cross-origin while
 * the server exposes it. A tier has a handful of stages, so fetching ids is
 * cheap and depends on nothing but the body. */
export async function countStagesForTier(tierId: string) {
  const { data, error } = await supabase
    .from("onboarding_stages")
    .select("id")
    .eq("tier_id", tierId);

  if (error) throw error;
  return data?.length ?? 0;
}

export async function getTierDocumentLinks() {
  const { data, error } = await supabase
    .from("tier_onboarding_documents")
    .select("tier_id, document_id");

  if (error) throw error;
  return data;
}

export async function linkDocumentToTier(documentId: string, tierId: string) {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("tier_onboarding_documents")
    .insert({ user_id: userId, tier_id: tierId, document_id: documentId });

  if (error) throw error;
}

export async function unlinkDocumentFromTier(
  documentId: string,
  tierId: string
) {
  const { error } = await supabase
    .from("tier_onboarding_documents")
    .delete()
    .eq("document_id", documentId)
    .eq("tier_id", tierId);

  if (error) throw error;
}

/* --------------------------------------------------------- runs (runtime) */

/** Starts a client's onboarding: freezes the chosen documents against their
 * data and copies the tier's process in as their own checklist. Nothing
 * downstream reads a template or a stage again — editing or deleting either
 * later cannot touch what this client already has. */
export async function createOnboardingRun({
  proposalId,
  tierId,
  values,
  documents,
}: {
  proposalId: string;
  tierId: string | null;
  values: PlaceholderValues;
  documents: OnboardingDocument[];
}) {
  const userId = await getCurrentUserId();

  const { data: run, error: runError } = await supabase
    .from("onboarding_runs")
    .insert({
      user_id: userId,
      proposal_id: proposalId,
      tier_id: tierId,
      client_name: values.client_name,
      tier_name: values.tier_name,
    })
    .select()
    .single();

  if (runError) throw runError;

  if (documents.length > 0) {
    const { error: docsError } = await supabase
      .from("onboarding_run_documents")
      .insert(
        documents.map((document) => ({
          user_id: userId,
          run_id: run.id,
          document_id: document.id,
          name: document.name,
          body: renderTemplate(document.body, values),
        }))
      );

    if (docsError) throw docsError;
  }

  // The checklist is frozen at the same moment and for the same reason: the
  // client's steps are theirs from here, not a live view of your process.
  await freezeStagesOntoRun(run.id, tierId);

  return run;
}

export async function getRunForProposal(proposalId: string) {
  const { data, error } = await supabase
    .from("onboarding_runs")
    .select("*")
    .eq("proposal_id", proposalId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getRunDocuments(runId: string) {
  const { data, error } = await supabase
    .from("onboarding_run_documents")
    .select("id, name, created_at")
    .eq("run_id", runId)
    .order("created_at");

  if (error) throw error;
  return data;
}

export async function getRunDocumentById(id: string) {
  const { data, error } = await supabase
    .from("onboarding_run_documents")
    .select("*, onboarding_runs (client_name, tier_name)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

/* ------------------------------------------------------ stages (authoring) */

export async function getOnboardingStages() {
  const { data, error } = await supabase
    .from("onboarding_stages")
    .select("*")
    .order("position")
    .order("created_at");

  if (error) throw error;
  return data;
}

export async function createOnboardingStage(
  tierId: string,
  title: string,
  position: number
) {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("onboarding_stages")
    .insert({ user_id: userId, tier_id: tierId, title, position });

  if (error) throw error;
}

export async function updateOnboardingStage(
  id: string,
  fields: { title?: string; notes?: string | null; day_offset?: number | null; position?: number }
) {
  const { error } = await supabase
    .from("onboarding_stages")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteOnboardingStage(id: string) {
  const { error } = await supabase
    .from("onboarding_stages")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/* --------------------------------------------------------- steps (runtime) */

export async function getRunSteps(runId: string) {
  const { data, error } = await supabase
    .from("onboarding_run_steps")
    .select("*")
    .eq("run_id", runId)
    .order("position")
    .order("created_at");

  if (error) throw error;
  return data;
}

/** Ticking a step records when, not just that — the date is the useful part
 * when you're reconstructing what happened for a client. */
export async function setStepCompleted(id: string, completed: boolean) {
  const { error } = await supabase
    .from("onboarding_run_steps")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) throw error;
}

/** Copies a tier's stages onto a run as its own frozen checklist. */
export async function freezeStagesOntoRun(runId: string, tierId: string | null) {
  if (!tierId) return 0;
  const userId = await getCurrentUserId();

  const { data: stages, error: stagesError } = await supabase
    .from("onboarding_stages")
    .select("*")
    .eq("tier_id", tierId)
    .order("position")
    .order("created_at");

  if (stagesError) throw stagesError;
  if (!stages || stages.length === 0) return 0;

  const { error } = await supabase.from("onboarding_run_steps").insert(
    stages.map((stage, index) => ({
      user_id: userId,
      run_id: runId,
      stage_id: stage.id,
      position: index,
      day_offset: stage.day_offset,
      title: stage.title,
      notes: stage.notes,
    }))
  );

  if (error) throw error;
  return stages.length;
}

export type ResyncResult = { added: number; updated: number; removed: number };

/** Pulls process changes into a run that has already started.
 *
 * Matches on stage_id rather than wiping and re-copying, so ticks survive.
 * **A completed step is never deleted** — it records work that actually
 * happened, even if the stage has since left the template. Only uncompleted
 * orphans go. That rule is what makes this safe to click. */
export async function resyncRunFromTemplate(
  runId: string,
  tierId: string | null
): Promise<ResyncResult> {
  const userId = await getCurrentUserId();
  const result: ResyncResult = { added: 0, updated: 0, removed: 0 };

  const [steps, stages] = await Promise.all([
    getRunSteps(runId),
    tierId
      ? supabase
          .from("onboarding_stages")
          .select("*")
          .eq("tier_id", tierId)
          .order("position")
          .order("created_at")
          .then(({ data, error }) => {
            if (error) throw error;
            return data ?? [];
          })
      : Promise.resolve([]),
  ]);

  const stepByStage = new Map(
    steps.filter((step) => step.stage_id).map((step) => [step.stage_id!, step])
  );
  const liveStageIds = new Set(stages.map((stage) => stage.id));

  for (const [index, stage] of stages.entries()) {
    const existing = stepByStage.get(stage.id);
    if (existing) {
      const unchanged =
        existing.title === stage.title &&
        existing.notes === stage.notes &&
        existing.day_offset === stage.day_offset &&
        existing.position === index;
      if (!unchanged) {
        const { error } = await supabase
          .from("onboarding_run_steps")
          .update({
            title: stage.title,
            notes: stage.notes,
            day_offset: stage.day_offset,
            position: index,
            // completed_at deliberately untouched.
          })
          .eq("id", existing.id);
        if (error) throw error;
        result.updated += 1;
      }
    } else {
      const { error } = await supabase.from("onboarding_run_steps").insert({
        user_id: userId,
        run_id: runId,
        stage_id: stage.id,
        position: index,
        day_offset: stage.day_offset,
        title: stage.title,
        notes: stage.notes,
      });
      if (error) throw error;
      result.added += 1;
    }
  }

  // Orphans: the stage is gone from the template (stage_id nulled by the FK,
  // or no longer in the live set). Keep the ones already done.
  const orphans = steps.filter(
    (step) =>
      step.completed_at == null &&
      (step.stage_id == null || !liveStageIds.has(step.stage_id))
  );
  for (const orphan of orphans) {
    const { error } = await supabase
      .from("onboarding_run_steps")
      .delete()
      .eq("id", orphan.id);
    if (error) throw error;
    result.removed += 1;
  }

  return result;
}

/* ----------------------------------------------------------- runs listing */

export async function getOnboardingRuns() {
  const { data, error } = await supabase
    .from("onboarding_runs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getOnboardingRunById(id: string) {
  const { data, error } = await supabase
    .from("onboarding_runs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteOnboardingRun(id: string) {
  const { error } = await supabase
    .from("onboarding_runs")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/** Progress for the runs list, in one query rather than one per run. */
export async function getRunProgress() {
  const { data, error } = await supabase
    .from("onboarding_run_steps")
    .select("run_id, completed_at");

  if (error) throw error;

  const progress = new Map<string, { done: number; total: number }>();
  for (const step of data ?? []) {
    const current = progress.get(step.run_id) ?? { done: 0, total: 0 };
    current.total += 1;
    if (step.completed_at) current.done += 1;
    progress.set(step.run_id, current);
  }
  return progress;
}
