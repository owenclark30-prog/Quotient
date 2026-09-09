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

/** Freezes the chosen templates against this client's data and stores the
 * result. Nothing downstream reads a template again — editing or deleting one
 * later cannot touch what has already gone out. */
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
