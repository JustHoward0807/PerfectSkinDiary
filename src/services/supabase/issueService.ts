import { supabase } from './supabase';

interface CreateIssueParams {
  userId: string;
  title: string;
  targetConcerns: string[];
  goalImageUrl: string;
  baselineScores: unknown;
}

export async function createIssue(params: CreateIssueParams): Promise<string> {
  const { data, error } = await supabase
    .from('issues')
    .insert({
      user_id: params.userId,
      title: params.title,
      target_concerns: params.targetConcerns,
      goal_image_url: params.goalImageUrl,
      baseline_scores: params.baselineScores,
    })
    .select('id')
    .single();
  if (error) throw new Error(`createIssue failed: ${error.message}`);
  return data.id;
}

interface CreateDayOneEntryParams {
  issueId: string;
  userId: string;
  photoUrl: string;
  analysisScores: unknown;
}

export async function createDayOneEntry(params: CreateDayOneEntryParams): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabase
    .from('entries')
    .insert({
      issue_id: params.issueId,
      user_id: params.userId,
      entry_date: today,
      photo_url: params.photoUrl,
      analysis_scores: params.analysisScores,
      delta_scores: null,
    });
  if (error) throw new Error(`createDayOneEntry failed: ${error.message}`);
}
